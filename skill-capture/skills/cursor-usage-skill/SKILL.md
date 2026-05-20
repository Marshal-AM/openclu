---
name: record-screen-with-python
description: This skill records the screen using Python and is useful when creating tutorials or demonstrations of software applications.
triggers:
  - "start screen recording"
  - "record screen with python"
expertise_source: human_recording
recorded_at: 2023-12-01
---

## Overview
This skill allows users to record their screen using Python, which can be useful for creating tutorials, demonstrations, or presentations. The skill utilizes the OpenCV and PyAutoGUI libraries to capture the screen and save it as a video file. The expert demonstrates how to set up the recording environment and run the script using npm.

## Prerequisites
* Python is installed on the system
* Required libraries (OpenCV, PyAutoGUI, etc.) are installed
* A code editor (such as Visual Studio Code) is available
* A terminal or command prompt is available

## Steps
1. Open the code editor (Visual Studio Code) and navigate to the project directory
2. Open the relevant files (capture.py, process.py, requirements.txt) in the editor
3. Run the script using npm in the terminal
4. The script will start recording the screen and save it as a video file
5. To stop the recording, the user can manually stop the script or use a keyboard shortcut

## Decision branches
* If the user encounters a deprecation warning (e.g., mss.mss being deprecated), they can update the library or use an alternative
* If the recording does not start, the user can check the terminal output for error messages or try running the script again

## Common mistakes
* Forgetting to install required libraries or dependencies
* Not navigating to the correct project directory
* Not running the script in the correct environment (e.g., using the wrong Python version)

## Tools and context
* Visual Studio Code (code editor)
* Python (programming language)
* OpenCV and PyAutoGUI (libraries for screen capture and automation)
* npm (package manager for running scripts)
* Terminal or command prompt (for running commands and viewing output)

## Notes
* The expert mentions that the recording has started, indicating that the script is working correctly
* The user should be aware of any deprecation warnings or error messages that may appear during the recording process
* The expert uses a specific command to run the script, which may need to be modified depending on the user's environment or setup.