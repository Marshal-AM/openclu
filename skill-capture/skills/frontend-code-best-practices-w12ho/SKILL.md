---
name: frontend-code-best-practices
description: "it is a skill from a recorded PR review session which informs the agent about frontend dev/coding best practices from the comments of the PR review."
triggers:
  - "frontend"
  - "software development"
  - "best practices"
  - "coding"
expertise_source: "Marshal"
recorded_at: "2026-05-26T10:21:28.331Z"
---

---
name: reviewing-pull-requests-for-frontend-best-practices
description: This skill reviews pull requests for frontend code changes, ensuring adherence to best practices such as semantic HTML, accessibility, and proper use of CSS layouts, and is used when reviewing frontend code submissions.
triggers:
  - "review frontend pull request"
  - "check code for semantic HTML"
  - "ensure accessibility in frontend code"
expertise_source: human_recording
recorded_at: 2023-12-01

## Overview
This skill enables the review of pull requests for frontend code changes, focusing on best practices such as using semantic HTML elements, avoiding tables for layout, and ensuring accessibility. It helps maintain high-quality frontend code by identifying common mistakes and providing constructive feedback. The skill is demonstrated through a GitHub pull request review, where the reviewer leaves comments on specific code changes.

## Prerequisites
* The pull request contains frontend code changes
* The reviewer has knowledge of frontend best practices and accessibility guidelines
* The code is hosted on a GitHub repository

## Steps
1. Navigate to the GitHub pull request page
2. Review the code changes made in the pull request
3. Identify areas for improvement, such as:
	* Missing lang attribute on HTML tag
	* Using tables for layout instead of CSS grid or flexbox
	* Lack of semantic elements (e.g., using nested divs instead of nav or header tags)
4. Leave comments on the pull request, addressing each identified issue
5. Post the review to provide feedback to the code author

## Decision branches
* If the code uses tables for layout, suggest using CSS grid or flexbox instead
* If the code lacks semantic elements, recommend using appropriate HTML tags (e.g., nav, header, footer)
* If the code has accessibility issues, provide feedback on how to improve accessibility

## Common mistakes
* Using tables for layout instead of CSS grid or flexbox
* Not using semantic HTML elements
* Not including the lang attribute on the HTML tag

## Tools and context
* GitHub for hosting and reviewing code
* Knowledge of frontend best practices and accessibility guidelines
* CSS grid and flexbox for layout

## Notes
* Semantic elements improve accessibility, SEO, and maintainability
* Using the lang attribute on the HTML tag is essential for accessibility
* Providing constructive feedback is crucial for helping the code author improve their code quality
