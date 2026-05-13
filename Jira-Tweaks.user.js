// ==UserScript==
// @name         Jira Tweaks
// @namespace    https://github.com/Cigaras/Jira-Tweaks
// @version      1.1.0
// @description  Various Jira tweaks
// @author       Valdas V.
// @homepage     https://github.com/Cigaras/Jira-Tweaks
// @match        https://*/jira/*
// @icon         https://jira.atlassian.com/favicon.ico
// @require      https://raw.github.com/odyniec/MonkeyConfig/master/monkeyconfig.js
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    // Config
    var cfg = new MonkeyConfig({
        title: 'Jira Tweaks configuration',
        menuCommand: true,
        params: {
            change_activity_items_order_to_oldest_first: {
                type: 'checkbox',
                default: true
            },
            collapse_gitlab_comments: {
                type: 'checkbox',
                default: true
            },
            add_quick_scroll_button: {
                type: 'checkbox',
                default: true
            }
        }
    });

    // Auto-sort activity to oldest first, stop if user manually clicks the sort button
    var autoSortEnabled = true;
    var autoSortClicking = false;
    var sortButtonListenerAdded = false;

    // Collapse expanded GitLab-Jira Integration comments using JIRA's native twixi toggle.
    // Stops auto-collapsing for the session if the user manually expands any of them.
    var autoCollapseGitlab = true;

    function collapseGitlabComments(activityModule) {
        if (!cfg.get('collapse_gitlab_comments')) return;
        if (!autoCollapseGitlab) return;

        const scrollEl = document.querySelector('.issue-view, .detail-panel') || document.documentElement;
        const savedScrollTop = scrollEl.scrollTop;
        const savedWindowScrollY = window.scrollY;
        const savedFocus = document.activeElement;
        let didCollapse = false;

        activityModule.querySelectorAll('.activity-comment.twixi-block.expanded').forEach(function(comment) {
            if (!comment.querySelector('a.user-hover[rel="gitlab"]')) return;
            if (comment.dataset.jtGitlabHandled) return;

            comment.dataset.jtGitlabHandled = 'true';

            const expandBtn = comment.querySelector('.twixi-wrap.concise button.twixi');
            if (expandBtn) {
                expandBtn.addEventListener('click', function() {
                    autoCollapseGitlab = false;
                }, { once: true });
            }

            const collapseBtn = comment.querySelector('button.twixi.aui-iconfont-expanded');
            if (collapseBtn) {
                collapseBtn.click();
                didCollapse = true;
            }
        });

        if (didCollapse) {
            requestAnimationFrame(function() {
                scrollEl.scrollTop = savedScrollTop;
                window.scrollTo(0, savedWindowScrollY);
                if (savedFocus && savedFocus !== document.body) {
                    savedFocus.focus();
                } else {
                    document.activeElement.blur();
                }
            });
        }
    }

    // Add scroll button
    function addScrollButton(issueContainer) {

        // Create the floating button element
        var scrollButton = document.createElement('button');
        scrollButton.id = 'scroll-button';
        scrollButton.classList.add('aui-button'); // https://aui.atlassian.com/aui/9.1/docs/buttons.html
        scrollButton.style.position = 'fixed';
        scrollButton.style.bottom = '20px';
        scrollButton.style.right = '37px';
        scrollButton.style.zIndex = '9999';
        scrollButton.title = 'Scroll to bottom';

        // Create the button label element
        var scrollButtonLabel = document.createElement('span');
        scrollButtonLabel.classList.add('aui-icon'); // https://aui.atlassian.com/aui/9.1/docs/icons.html
        scrollButtonLabel.classList.add('aui-icon-small');
        scrollButtonLabel.classList.add('aui-iconfont-chevron-down-circle');
        scrollButtonLabel.innerHTML = '▼';

        // Append the label to the button
        scrollButton.appendChild(scrollButtonLabel);

        // Add button event listener
        scrollButton.addEventListener('click', function() {
            if (issueContainer.scrollTop < (issueContainer.scrollHeight - issueContainer.clientHeight)) {
                issueContainer.scrollTo({
                    top: issueContainer.scrollHeight,
                    behavior: 'smooth'
                });
            } else {
                issueContainer.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }
        });

        // Add scroll event listener
        issueContainer.addEventListener('scroll', function() {
            if (issueContainer.scrollTop < (issueContainer.scrollHeight - issueContainer.clientHeight)) {
                scrollButton.title = 'Scroll to bottom';
                scrollButtonLabel.classList.remove('aui-iconfont-chevron-up-circle');
                scrollButtonLabel.classList.add('aui-iconfont-chevron-down-circle');
                scrollButtonLabel.innerHTML = '▼';
            } else {
                scrollButton.title = 'Scroll to top';
                scrollButtonLabel.classList.remove('aui-iconfont-chevron-down-circle');
                scrollButtonLabel.classList.add('aui-iconfont-chevron-up-circle');
                scrollButtonLabel.innerHTML = '▲';
            }
        });

        // Append the button to the document body
        document.body.appendChild(scrollButton);
    }

    // Main function, executed every second
    setInterval(() => {
        const activityModule = document.getElementById('activitymodule');
        if (activityModule) {
            if (cfg.get('change_activity_items_order_to_oldest_first')) {
                const sortButton = activityModule.querySelector('#sort-button');
                if (sortButton) {
                    if (!sortButtonListenerAdded) {
                        sortButtonListenerAdded = true;
                        sortButton.addEventListener('click', function() {
                            if (!autoSortClicking) autoSortEnabled = false;
                        });
                    }
                    if (autoSortEnabled && sortButton.dataset.order === 'asc') {
                        autoSortClicking = true;
                        sortButton.click();
                        autoSortClicking = false;
                    }
                }
            }
            collapseGitlabComments(activityModule);
            var scrollButton = document.getElementById('scroll-button');
            if (cfg.get('add_quick_scroll_button')) {
                var issueContainer = document.querySelector(".issue-view, .detail-panel");
                if (issueContainer && !scrollButton) {
                    addScrollButton(issueContainer);
                }
            } else if (scrollButton) {
                scrollButton.remove();
            }
        }
    }, 1000);

})();
