# GitHub PR Filter Counter

A Chrome extension that shows `+/-` line counts for only the files you filter on a pull request.

GitHub lets you filter a PR's changed files by extension (for example, hide `.md` files). The header still shows the totals for every file. This extension adds the filtered totals next to them:

```
+1,035 -24 ▮▮▮▮▮ (+473 −17)
```

## How it works

- It reads the `file-filters[]` values from the URL, such as `?file-filters[]=.ts`.
- It fetches the PR's file list from the GitHub API once per PR.
- It sums the additions and deletions for the files that match.
- It finds the PR diffstat by its screen-reader label (`Lines changed: N additions & M deletions`) and adds the badge after it. On the classic `/files` view it uses `#diffstat`.
- If it can't find the diffstat, it shows a floating badge at the top right.

It only handles extension filters. Other filters, such as hiding viewed files, don't change the totals.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. Open the extension's **Details → Extension options**.
4. Paste a GitHub token and click **Save**. You need one for private repos. `gh auth token | pbcopy` copies yours.

After you change the code, click the reload icon on the extension card and refresh the PR tab.
