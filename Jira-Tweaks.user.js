// ==UserScript==
// @name         Jira Tweaks
// @namespace    https://github.com/Cigaras/Jira-Tweaks
// @version      1.3.0
// @description  Various Jira tweaks
// @author       kuppp
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
 
    // Hide GitLab-Jira Integration comments entirely (display: none), rather than
    // collapsing them via JIRA's native twixi toggle. Each comment is hidden once
    // (tracked via a dataset flag) and stays hidden — there is no toggle left in
    // the UI to bring it back, so unlike the old collapse behaviour this does not
    // watch for the user manually re-expanding anything.
 
    // --- Focused-comment handling ---
    // When the page is opened on a focused comment (?focusedId=NNN / #comment-NNN),
    // Jira itself scrolls to that comment and keeps it there. Hiding GitLab
    // comments above it shifts the layout the same way collapsing used to:
    //   * With a focused comment: re-anchor to the focused comment after hiding.
    //   * Without a focused comment: return to the top after hiding.
    // We back off as soon as the user scrolls, so we never fight them.
    var focusedCommentId = (function() {
        var sources = [];
        try { if (location.hash) sources.push(location.hash); } catch (e) {}
        try { if (location.search) sources.push(location.search); } catch (e) {}
        try {
            var nav = performance.getEntriesByType('navigation');
            if (nav && nav[0] && nav[0].name) sources.push(nav[0].name);
        } catch (e) {}
        try { if (document.referrer) sources.push(document.referrer); } catch (e) {}
        for (var i = 0; i < sources.length; i++) {
            var m = sources[i].match(/focusedId=(\d+)/) || sources[i].match(/comment-(\d+)/);
            if (m) return m[1];
        }
        return null;
    })();
 
    var userHasScrolled = false;
 
    function restoreScrollAfterHide() {
        if (userHasScrolled) return;
        var scrollEl = document.querySelector('.issue-view, .detail-panel') || document.documentElement;
 
        if (focusedCommentId) {
            // Re-anchor to the focused comment (hiding items above it shifts it).
            var el = document.getElementById('comment-' + focusedCommentId);
            if (el) {
                var scTop = scrollEl.getBoundingClientRect ? scrollEl.getBoundingClientRect().top : 0;
                if (Math.abs(el.getBoundingClientRect().top - scTop) >= 8) {
                    el.scrollIntoView({ block: 'start' });
                }
            }
        } else {
            // No focused comment -> hiding drifts the view, so return to the top.
            scrollEl.scrollTop = 0;
            window.scrollTo(0, 0);
        }
    }
 
    function hideGitlabComments(activityModule) {
        if (!cfg.get('collapse_gitlab_comments')) return;
 
        let didHide = false;
 
        activityModule.querySelectorAll('.activity-comment.twixi-block').forEach(function(comment) {
            if (!comment.querySelector('a.user-hover[rel="gitlab"]')) return;
            if (comment.dataset.jtGitlabHandled) return;
            comment.dataset.jtGitlabHandled = 'true';
            comment.style.display = 'none';
            didHide = true;
        });
 
        // After hiding, fix the scroll drift removing content causes: anchor to
        // the focused comment, or return to the top if there is none.
        if (didHide) {
            requestAnimationFrame(restoreScrollAfterHide);
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
 
    // Detect genuine user scrolling so we stop adjusting scroll once they take over.
    document.addEventListener('wheel', function() { userHasScrolled = true; }, { passive: true });
    document.addEventListener('touchmove', function() { userHasScrolled = true; }, { passive: true });
    document.addEventListener('keydown', function(e) {
        if ([32, 33, 34, 35, 36, 38, 40].indexOf(e.keyCode) !== -1) userHasScrolled = true;
    }, true);
 
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
 
            hideGitlabComments(activityModule);
 
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
