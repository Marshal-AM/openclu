---
name: abdz
description: "abdz"
triggers:
  - "general"
recorded_at: "2026-05-20T10:10:00.000Z"
---

## Overview
This skill accomplishes the setup and execution of a skill capture orchestrator, enabling the development and testing of AI agent skills. The orchestrator is run in Visual Studio Code, utilizing a terminal window to execute a command. The process involves navigating the project directory, running the orchestrator, and understanding the output.

## Prerequisites
* Visual Studio Code is installed and set up on the system
* The skill capture orchestrator project is cloned or downloaded
* Node.js and npm are installed and configured
* A terminal window is available in Visual Studio Code

## Steps
1. Open the project directory in Visual Studio Code
2. Navigate to the terminal window and change the directory to the orchestrator folder
3. Run the command 'npm run start' to initiate the orchestrator
4. Review the terminal output for the orchestrator's listening URL and any warnings or errors
    * If warnings about ngrok config file and binding default web address appear:
        + Check the ngrok configuration file for any issues
        + Verify the default web address binding
    * If the orchestrator fails to start:
        + Check the project dependencies and install any missing packages
        + Review the terminal output for error messages

## Decision branches
* If the orchestrator is already running, stop it before restarting
* If the ngrok config file is missing or corrupted, recreate or repair it before proceeding

## Common mistakes
* Failing to change the directory to the orchestrator folder before running the command
* Ignoring warnings about ngrok config file and binding default web address

## Tools and context
* Visual Studio Code
* Terminal window
* Node.js and npm
* ngrok config file
* Skill capture orchestrator project

## Notes
* The expert mentioned no specific timing cues, but it is essential to wait for the orchestrator to fully start before proceeding
* The expert referred to a README file or guide for instructions on trying the skill capture, indicating the importance of following documentation
* The orchestrator's listening URL and any warnings or errors should be carefully reviewed to ensure proper setup and execution.
