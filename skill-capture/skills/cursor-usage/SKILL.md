---
name: using-cursor-for-skill-capture
description: This skill demonstrates how to use a cursor to execute tasks and provide outputs in a project, particularly useful when working with skill capture projects.
triggers:
  - "open a project and use cursor"
  - "execute tasks with cursor"
expertise_source: human_recording
recorded_at: 2024-03-16
---

## Overview
This skill allows users to open a project, navigate to the chat section, and use the cursor to execute various tasks, such as planning tasks or providing outputs. The skill capture project is used as an example, showcasing how to work with a Python script in Visual Studio Code. The user can debug or create multi-tasks, making this skill versatile and efficient.

## Prerequisites
* A project is already set up and open
* The user has access to the chat section
* The user has basic knowledge of working with Visual Studio Code and Python scripts

## Steps
1. Open a project in Visual Studio Code
2. Navigate to the chat section
3. Type messages to specify the task to be executed
4. The agent will provide an output or execute the task
5. The user can debug or create multi-tasks as needed

## Decision branches
* If the user wants to execute a planning task:
  + Specify the task type in the chat section
  + The agent will provide a planning output
* If the user wants to debug a task:
  + Identify the task to be debugged
  + Use the terminal output to debug the task

## Common mistakes
* Not specifying the task type correctly
* Not using the correct syntax in the chat section
* Not checking the terminal output for errors

## Tools and context
* Visual Studio Code
* Python script (process.py)
* Terminal output
* Chat section

## Notes
* The user should be familiar with working with Visual Studio Code and Python scripts
* The skill capture project is used as an example, but this skill can be applied to other projects as well
* The user should pay attention to the terminal output for any errors or debugging information
* The chat section is used to specify the task type and provide input to the agent.