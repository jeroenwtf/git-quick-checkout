#!/usr/bin/env node

import simpleGit from "simple-git";
import select from "@inquirer/select";
import chalk from "chalk";

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
    let gitUserEmail = "";

    if (branches.all.length < 2) {
      console.warn(
        chalk.yellow(`Error: You only have one branch (${currentBranch}).`),
      );
      process.exit(1);
    }

    git.getConfig("user.email", (err, email) => {
      if (err) {
        console.error("Error getting git user email:", err);
      } else {
        gitUserEmail = email.value;
      }
    });

    const branchData = await Promise.all(
      branches.all.map(async (branch) => {
        try {
          const log = await git.log([branch]); // Explicitly get the log for the branch
          const lastCommit = log?.latest;

          return {
            branch,
            commitAuthor:
              gitUserEmail == lastCommit?.author_email
                ? "me"
                : lastCommit?.author_name,
            commitMessage: lastCommit?.message || chalk.gray("no commits yet"),
            commitDate: lastCommit ? new Date(lastCommit.date) : null,
            formattedDate: lastCommit
              ? formatRelativeDate(lastCommit.date)
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

        return {
          name: `${chalk.bold(branch)} ${chalk.gray(lastCommit)}`,
          short: branch,
          value: branch,
          disabled: branch == currentBranch && "[current]",
        };
      },
    );

    // Prompt user to select a branch
    const selectedBranch = await select({
      message: "Select a branch to checkout:",
      choices: branchList,
      loop: false,
      pageSize: 10,
    });

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

function formatRelativeDate(dateString) {
  const now = new Date();
  const date = new Date(dateString); // Parse the input date string

  // Calculate the difference in seconds
  const diffInSeconds = Math.floor((now - date) / 1000);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffInSeconds) < 60) {
    return rtf.format(-diffInSeconds, "seconds");
  }

  if (Math.abs(diffInSeconds) < 3600) {
    return rtf.format(-Math.floor(diffInSeconds / 60), "minutes");
  }

  if (Math.abs(diffInSeconds) < 86400) {
    return rtf.format(-Math.floor(diffInSeconds / 3600), "hours");
  }

  if (Math.abs(diffInSeconds) < 604800) {
    return rtf.format(-Math.floor(diffInSeconds / 86400), "days");
  }

  if (Math.abs(diffInSeconds) < 2629746) {
    return rtf.format(-Math.floor(diffInSeconds / 604800), "weeks");
  }

  if (Math.abs(diffInSeconds) < 31556952) {
    return rtf.format(-Math.floor(diffInSeconds / 2629746), "months");
  }

  return rtf.format(-Math.floor(diffInSeconds / 31556952), "years");
}

main();
