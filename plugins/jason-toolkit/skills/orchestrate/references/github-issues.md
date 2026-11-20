# GitHub issue workflow

For an existing parent issue, enumerate linked child issues with `gh api --paginate repos/<owner>/<repo>/issues/<parent>/sub_issues`. Read each child's scope, acceptance criteria, dependencies, and hold status. Build the work order from those dependencies rather than from issue numbers or labels. If there are no children, treat it as a normal issue. Respect holds in either delivery mode.

When the user asks to record the plan in GitHub, reuse any existing parent and children. Record the goal and constraints in the parent. Give each child its scope, owned files, dependencies, and acceptance checks. Attach children as GitHub sub-issues so later runs can enumerate them. Use repository labels and progress conventions.

To attach a child with the CLI, get its numeric GitHub issue ID with `gh api repos/<owner>/<repo>/issues/<child> --jq .id`. Then use `gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<id>`. Supply the internal numeric ID using `-F`, not the displayed issue number.

Link shipping PRs to the issues they resolve and verify parent progress from actual merge and issue state. A plan-only request ends when the requested plan is delivered.
