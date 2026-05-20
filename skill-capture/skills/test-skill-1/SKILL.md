---
name: python-project-setup
description: This skill sets up a Python project in Visual Studio Code, including terminal interactions, and is used when starting a new Python development task.
triggers:
  - "set up python project"
  - "create new python environment"
expertise_source: human_recording
recorded_at: 2024-09-16
---

## Overview
This skill accomplishes the setup of a Python project in Visual Studio Code, including the creation of multiple terminals for different tasks. It enables developers to efficiently start a new Python project with the necessary tools and configurations. The skill involves interacting with the VS Code interface and using terminal commands.

## Prerequisites
* Visual Studio Code is installed on the system
* Python is installed and configured on the system
* The user has basic knowledge of Python and VS Code

## Steps
1. Open Visual Studio Code and create a new folder for the project
2. Open the terminal in VS Code and navigate to the project folder
3. Create a new virtual environment for the project using a terminal command
	* If the virtual environment is not created successfully:
		+ Check the Python installation and try again
		+ Consider using a different virtual environment tool
4. Activate the virtual environment and install necessary packages
5. Open a new terminal in VS Code for running the skill capture test
6. Open another terminal in VS Code for displaying a Powershell session

## Decision branches
* If the virtual environment creation fails, decide whether to retry or use a different tool
* If the package installation fails, decide whether to retry or investigate the issue further

## Common mistakes
* Forgetting to activate the virtual environment before installing packages
* Not checking the Python installation before creating a virtual environment

## Tools and context
* Visual Studio Code
* Python
* Virtual environment tool (e.g. venv or conda)
* Powershell

## Notes
* The expert mentioned the importance of using a virtual environment to isolate the project dependencies
* The expert used a specific terminal command to create the virtual environment, which may vary depending on the system configuration
* The expert opened multiple terminals in VS Code to separate different tasks, such as running the skill capture test and displaying a Powershell session.