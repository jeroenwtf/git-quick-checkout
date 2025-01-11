#!/usr/bin/env node

import simpleGit from "simple-git";
import inquirer from "inquirer";
import chalk from "chalk";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";

dayjs.extend(relativeTime);

const git = simpleGit();

async function main() {
  try {
    // Check for uncommitted changes
    const status = await git.status();
    if (status.files.length > 0) {
      console.error(chalk.red("Error: You have uncommitted changes."));
      console.log(
        chalk.gray("Please commit or stash them before switching branches."),
      );
      process.exit(1);
    }

    // Fetch branch list with last commit info
    const branches = await git.branchLocal();
    const currentBranch = branches.current;

    if (branches.all.length < 2) {
      console.warn(
        chalk.yellow(`Error: You only have one branch (${currentBranch}).`),
      );
      process.exit(1);
    }

    console.log(branches);
    const branchData = await Promise.all(
      branches.all.map(async (branch) => {
        try {
          const log = await git.log([branch]); // Explicitly get the log for the branch
          const lastCommit = log?.latest;

          return {
            branch,
            commitAuthor: lastCommit?.author_name,
            commitMessage: lastCommit?.message || chalk.gray("no commits yet"),
            commitDate: lastCommit ? new Date(lastCommit.date) : null,
            formattedDate: lastCommit
              ? dayjs(lastCommit.date).fromNow()
              : chalk.gray("no commits yet"),
          };
        } catch (err) {
          return {
            branch,
            commitAuthor: "",
            commitMessage: chalk.red("error fetching log"),
            commitDate: null,
            formattedDate: chalk.red("error"),
          };
        }
      }),
    );

    // Sort branches by commit date (most recent first)
    const sortedBranches = branchData.sort((a, b) => {
      if (a.commitDate && b.commitDate) {
        return b.commitDate - a.commitDate; // Descending order
      }
      if (a.commitDate) return -1;
      if (b.commitDate) return 1;
      return 0;
    });

    // Format branches for the prompt
    const branchList = sortedBranches.map(
      ({ branch, commitAuthor, commitMessage, formattedDate }) => {
        const lastCommit = `${commitMessage} (${formattedDate} by ${commitAuthor})`;
        const current =
          branch == currentBranch ? chalk.yellow("[current] ") : "";
        return {
          name: `${chalk.bold(branch)} ${current}${chalk.gray(lastCommit)}`,
          value: branch,
        };
      },
    );

    // Prompt user to select a branch
    const { selectedBranch } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedBranch",
        message: "Select a branch to checkout:",
        choices: branchList,
        pageSize: 10,
        loop: false, // Prevent infinite looping
      },
    ]);

    // Checkout the selected branch
    await git.checkout(selectedBranch);
  } catch (error) {
    if (error instanceof Error && error.name === "ExitPromptError") {
      console.log(chalk.gray("Bye!"));
    } else {
      console.error(chalk.red("An error occurred:"), error.message);
    }
    process.exit(1);
  }
}

main();
