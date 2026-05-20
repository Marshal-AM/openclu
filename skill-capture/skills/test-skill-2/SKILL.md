---
name: capture-skill-with-skill-capture-cli
description: This skill captures a new skill using the skill-capture-cli command when a user needs to document and extract knowledge from an expert demonstration.
triggers:
  - "capture skill demonstration"
  - "start skill capture process"
expertise_source: human_recording
recorded_at: 2023-12-01
---

## Overview
This skill enables the capture of expert knowledge by utilizing the skill-capture-cli command in a terminal, specifically within the context of a Python project in Visual Studio Code. The skill involves interacting with the terminal, a chat window, and the code editor to successfully capture and document the skill. By following this skill, users can effectively extract and record knowledge from expert demonstrations.

## Prerequisites
* The user must have Visual Studio Code installed with the necessary extensions for Python development.
* The user must have the skill-capture-cli command-line tool installed and configured.
* The user must be working on a Python project with a terminal and chat window available.

## Steps
1. Open the terminal in Visual Studio Code and navigate to the project directory.
2. Run the skill-capture-cli command with the necessary arguments to initiate the skill capture process.
3. Interact with the chat window to discuss changes and issues related to the project, specifically about listing skills in Arkiv and CLI usage.
4. Edit the code file (e.g., process.py) as needed to reflect the captured skill.

## Decision branches
* If the skill-capture-cli command returns an error, troubleshoot the issue by checking the command arguments and the project configuration.
* If the chat window discussion reveals a need for changes to the skill capture process, adjust the command arguments or the code file accordingly.

## Common mistakes
* Failing to navigate to the correct project directory before running the skill-capture-cli command.
* Not properly configuring the skill-capture-cli command-line tool before use.

## Tools and context
* Visual Studio Code with Python extensions
* skill-capture-cli command-line tool
* Terminal for running commands and viewing output
* Chat window for discussing project changes and issues

## Notes
* The expert emphasized the importance of properly configuring the skill-capture-cli tool and navigating to the correct project directory before initiating the skill capture process.
* The expert also highlighted the need for effective communication and discussion in the chat window to ensure that the captured skill accurately reflects the project requirements.