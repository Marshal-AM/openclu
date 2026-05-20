---
name: extract-skill-from-recording
description: Extracts structured skill knowledge from human recordings to create a SKILL.md file, used when creating AI agent skills from expert demonstrations.
triggers:
  - "extract skill from recording"
  - "create skill from human demo"
expertise_source: human_recording
recorded_at: 2023-12-01
---

## Overview
This skill extracts knowledge from human recordings to create a SKILL.md file, which can be used by AI agents to replicate the demonstrated skill. The skill involves analyzing audio transcripts and screen frame annotations to identify key steps, decision points, and expert tips. By automating the extraction process, this skill enables efficient creation of AI agent skills.

## Prerequisites
* A full audio transcript with timestamps is available
* Screen frame annotations are provided, showing what was happening on screen at each moment
* The recording demonstrates a specific skill or task

## Steps
1. Receive the audio transcript and screen frame annotations
2. Analyze the transcript to identify key phrases and triggers
3. Examine the screen frame annotations to understand the context and actions taken
4. Determine the skill name, description, and expertise source
5. Identify the steps involved in the demonstrated skill
    * If the step involves a decision:
        + Identify the decision point
        + Determine the possible branches
        + Outline the actions for each branch
6. Document common mistakes and how to avoid them
7. Note the tools and context used in the demonstration
8. Record any additional notes, tips, or timing cues mentioned by the expert

## Decision branches
* If the recording is unclear or incomplete:
    + Request additional information or clarification
    + Consider using alternative sources or expertise
* If the demonstrated skill is complex or nuanced:
    + Break down the skill into smaller, more manageable steps
    + Identify key decision points and branches

## Common mistakes
* Failing to provide clear and complete recordings
* Not accounting for context or environmental factors
* Overlooking critical decision points or branches

## Tools and context
* Audio transcript analysis tools
* Screen frame annotation software
* Visual Studio Code (for coding and terminal interaction)
* CDR server (for running and testing skills)

## Notes
* The expert emphasized the importance of clear and concise communication when demonstrating a skill
* The use of multiple terminals and screens can help to provide additional context and information
* Timing cues, such as pauses or hesitations, can indicate important decision points or areas of uncertainty