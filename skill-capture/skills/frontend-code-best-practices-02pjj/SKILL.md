---
name: frontend-code-best-practices
description: "it is a skill from a recorded PR review session which informs the agent about frontend dev/coding best practices from the comments of the PR review."
triggers:
  - "frontend"
  - "software development"
  - "best practices"
  - "coding"
expertise_source: "Marshal"
recorded_at: "2026-05-26T10:13:15.182Z"
---

## Overview
This skill reviews pull requests for accessibility and front-end best practices, ensuring that code changes meet the required standards. It involves evaluating the use of semantic elements, CSS grid, and flexbox, as well as checking for missing lang attributes and improper use of tables. The skill provides feedback to engineers on how to improve their code, enhancing the overall quality and maintainability of the project.

## Prerequisites
* The pull request is submitted and available for review
* The reviewer has the necessary permissions and access to the code repository
* The code changes are related to front-end development and accessibility

## Steps
1. Open the pull request and review the code changes
	* Check for missing lang attributes and suggest additions
	* Evaluate the use of tables and suggest alternatives (CSS grid or flexbox) if necessary
	* Review the use of semantic elements (header, nav, etc.) and provide feedback on improvements
2. Leave comments on the code changes, providing constructive feedback and suggestions for improvement
	* Focus on accessibility, SEO, and maintainability
	* Use clear and concise language, avoiding technical jargon when possible
3. Review the code changes again, ensuring that all necessary feedback has been provided
	* Check for any additional issues or areas for improvement

## Decision branches
* If the code changes include tables used for layout, suggest using CSS grid or flexbox instead
* If the code changes are missing semantic elements, suggest adding them to improve accessibility
* If the code changes have missing lang attributes, suggest adding them to improve accessibility

## Common mistakes
* Using tables for layout instead of CSS grid or flexbox
* Not using semantic elements (header, nav, etc.)
* Missing lang attributes

## Tools and context
* GitHub (or other code repository platform)
* Code editor or IDE
* Knowledge of front-end development and accessibility best practices

## Notes
* The reviewer should provide clear and concise feedback, focusing on accessibility, SEO, and maintainability
* The reviewer should use the code repository platform's commenting system to leave feedback and suggestions
* The reviewer should be familiar with front-end development and accessibility best practices to provide effective feedback.
