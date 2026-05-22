---
name: xyz
description: "xyz"
triggers:
  - "general"
recorded_at: "2026-05-22T03:40:00.000Z"
---

## Overview
This skill accomplishes the configuration of a .gitignore file to properly exclude unnecessary files and directories from a Git repository, ensuring a clean and organized project structure. The expert demonstrates how to work with the .gitignore file and interact with the terminal to verify the changes. The skill involves identifying and ignoring specific files and directories.

## Prerequisites
* A Git repository is initialized in the project directory
* Visual Studio Code is installed and set up with the necessary extensions
* A terminal is available for running commands

## Steps
1. Open the .gitignore file in Visual Studio Code
2. Identify the files and directories to be ignored
3. Add the necessary patterns to the .gitignore file
4. Save the changes to the .gitignore file
5. Run a command in the terminal to verify the changes
    * If the changes are not reflected:
        + Check for typos in the .gitignore file
        + Verify that the Git repository is properly initialized
    * If there are linter issues:
        + Address the issues by modifying the code or configuration
        + Re-run the command to verify the changes

## Decision branches
* If a file or directory is not being ignored as expected:
    + Check the .gitignore file for typos or incorrect patterns
    + Verify that the file or directory is not being tracked by Git
* If there are conflicts between the .gitignore file and other Git configuration files:
    + Resolve the conflicts by modifying the relevant files
    + Re-run the command to verify the changes

## Common mistakes
* Forgetting to save changes to the .gitignore file
* Using incorrect patterns in the .gitignore file
* Not verifying the changes after updating the .gitignore file

## Tools and context
* Visual Studio Code with Git extension
* Terminal for running Git commands
* .gitignore file for configuring ignored files and directories
* Linter for identifying code issues

## Notes
* The expert mentions the importance of verifying the changes after updating the .gitignore file
* The expert uses a skill-capture-orchestrator in the terminal to run commands and verify the changes
* The expert addresses linter issues by modifying the code and configuration, demonstrating attention to detail and best practices.
