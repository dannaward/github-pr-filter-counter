# GitHub PR Filter Counter

A Chrome extension that shows `+/-` line counts for only the files you filter on a pull request.

GitHub lets you filter a PR's changed files by extension (for example, hide `.md` files). The header still shows the totals for every file. This extension adds the filtered totals next to them:

<img width="528" height="205" alt="image" src="https://github.com/user-attachments/assets/e1870200-93f5-4158-843d-b3dabf00e46f" />


## Folders

- `chrome-extension/`: load this folder in Chrome as an unpacked extension.
- `tampermonkey/`: the same logic as a userscript for Tampermonkey.

## How it works

- It reads the `file-filters[]` values from the URL, such as `?file-filters[]=.ts`.
- It fetches the PR's file list from the GitHub API once per PR.
- It sums the additions and deletions for the files that match.
- It finds the PR diffstat by its screen-reader label (`Lines changed: N additions & M deletions`) and adds the badge after it. On the classic `/files` view it uses `#diffstat`.
- If it can't find the diffstat, it shows a floating badge at the top right.

It only handles extension filters. Other filters, such as hiding viewed files, don't change the totals.

## Install as a Chrome extension

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick the `chrome-extension/` folder.
3. Open the extension's **Details → Extension options**.
4. Paste a GitHub token and click **Save**. You need one for private repos. `gh auth token | pbcopy` copies yours.

After you change the code, click the reload icon on the extension card and refresh the PR tab.

## Install with Tampermonkey

The same logic lives in `tampermonkey/github-pr-filter-counter.user.js`.

1. Open the Tampermonkey dashboard and click the **+** tab to create a new script.
2. Replace the template with the contents of `tampermonkey/github-pr-filter-counter.user.js` and save. `pbcopy < tampermonkey/github-pr-filter-counter.user.js` copies it.
3. Open any GitHub page, click the Tampermonkey icon, and pick **Set GitHub token**.
4. Paste your token and click **OK**.

The repo is private, so Tampermonkey can't install the script from its raw URL. Paste it in instead.

If you change `chrome-extension/content.js`, make the same change in the userscript. Only the token storage differs.
