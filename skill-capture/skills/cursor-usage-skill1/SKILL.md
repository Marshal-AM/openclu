---
name: initiate-skill-capture
description: This skill initiates the capture of a skill demonstration using the skill-capture-cli command in Visual Studio Code, typically used when creating new AI agent skills.
triggers:
  - "start skill capture"
  - "initiate skill recording"
expertise_source: human_recording
recorded_at: 2023-12-01
---

## Overview
This skill accomplishes the initiation of a skill capture process in Visual Studio Code, allowing for the recording of screen and audio to create new AI agent skills. The process involves running a specific command in the terminal and managing the recording process. The skill is essential for creating high-quality skill demonstrations.

## Prerequisites
* Visual Studio Code is installed and running
* The skill-capture-cli command is installed and configured
* The terminal is available and accessible in Visual Studio Code

## Steps
1. Open the terminal in Visual Studio Code
2. Run the command 'skill-capture-cli@0.1.0 skill' to initiate the skill capture process
3. Wait for the CDR server to be ready and the 3-second countdown to finish
4. The skill capture process will start, and the terminal will show the recording status
5. To stop the recording, press the 'Q' key

## Decision branches
* If the CDR server is not ready, wait for it to become available before proceeding
* If the skill-capture-cli command is not installed, install it before running the command
* If the recording is not starting, check the terminal output for any error messages or warnings

## Common mistakes
* Forgetting to wait for the CDR server to be ready before starting the recording
* Not pressing the 'Q' key to stop the recording when finished
* Ignoring deprecation warnings about 'mss.mss' which may affect the recording process

## Tools and context
* Visual Studio Code
* skill-capture-cli command
* Terminal in Visual Studio Code

## Notes
* The expert mentioned the importance of waiting for the CDR server to be ready before starting the recording
* The expert also mentioned the deprecation warning about 'mss.mss' which may affect the recording process
* The timing of the recording initiation and the 3-second countdown is crucial for a successful skill capture process