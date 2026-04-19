"use strict"

const vscode = require('vscode');
const shiki = require('shiki');
const path = require('path');
const fs = require('fs');

module.exports.activate = (context) => {
    vscode.workspace.onDidChangeConfiguration((change) => {
        if (change.affectsConfiguration('markdownShiki.theme') ||
            change.affectsConfiguration('workbench.colorTheme')) {
            applyHighlighter();
        }
    }, undefined, context.subscriptions);

    // Default thems use `include` option that shiki doesn't support
    const defaultThemesMap = {
        'Visual Studio Light': 'light-plus',
        'Default Light+': 'light-plus',
        'Visual Studio Dark': 'dark-plus',
        'Default Dark+': 'dark-plus'
    }

    // Create mutable closure var that we can return to markdown-it but override at later points
    let doHighlight = (_code, _lang) => '';
    let defaultHighlight = (_code, _lang) => '';

    return {
        extendMarkdownIt(md) {
            defaultHighlight = md.options.highlight;
            md.options.highlight = (code, lang) => doHighlight(code, lang);
            applyHighlighter();
            return md;
        }
    }

    //TODO: why did we make the function async?
    async function applyHighlighter() {
        const configTheme = vscode.workspace.getConfiguration('markdownShiki').get('theme');
        const currentThemeName = vscode.workspace.getConfiguration('workbench').get('colorTheme');
        //TODO: what's the difference between themeName and themeData here? Why did we add the latter?
        let themeName;
        let themeData;

        if (configTheme !== null) {
            themeName = configTheme;
        } else if (defaultThemesMap[currentThemeName]) {
            themeName = defaultThemesMap[currentThemeName];
        } else {
            const colorThemePath = getCurrentThemePath(currentThemeName);
            if (colorThemePath) {
                try {
                    themeData = JSON.parse(fs.readFileSync(colorThemePath, 'utf-8'));
                    themeData.name = themeData.name || 'custom-theme';
                    themeName = themeData.name;
                } catch (e) {
                    // noop
                }
            }
        }

        if (!themeName) {
            themeName = 'dark-plus';
        }

        console.log(themeData && themeData.fg)

        try {
            const highlighter = await shiki.createHighlighter({
                themes: themeData ? [themeData] : [themeName],
                langs: Object.values(shiki.bundledLanguages),
            });

            // The preview will already have been rendered at this point so refresh it
            vscode.commands.executeCommand('markdown.preview.refresh');

            doHighlight = (code, lang) => {
                try {
                    const languageId = getLanguageId(lang);
                    if (languageId) {
                        let html = highlighter.codeToHtml(code, { lang: languageId, theme: themeName });
                        //TODO: can't we do this like it was before, modifying the bg key in the theme data?
                        // Don't set bg so that we use the preview's standard styling
                        html = html.replace(/(<pre[^>]*?style="[^"]*?)background-color:[^;"]*(;?)/, '$1$2');
                        return html;
                    }
                } catch (err) {
                    // noop
                }

                // Fallback to default highligher
                return defaultHighlight(code, lang);
            };
        } catch (err) {
            console.error('Failed to create Shiki highlighter:', err);
        }
    }

    function getCurrentThemePath(themeName) {
        for (const ext of vscode.extensions.all) {
            const themes = ext.packageJSON.contributes && ext.packageJSON.contributes.themes;
            if (!themes) continue;
            const theme = themes.find(theme => theme.label === themeName || theme.id === themeName);
            if (theme) {
                return path.join(ext.extensionPath, theme.path);
            }
        }
    }
}

function getLanguageId(inId) {
    for (const language of languages) {
        if (inId === language.name || language.identifiers.some(langId => inId === langId)) {
            return language.language;
        }
    }
    return undefined;
};

//TODO: please explain the changes you made to this array.
// should be the same content as here: https://github.com/microsoft/vscode-markdown-tm-grammar/blob/main/build.ts
// Taken from https://github.com/Microsoft/vscode-markdown-tm-grammar/blob/master/build.js
const languages = [
    { name: 'css', language: 'css', identifiers: ['css', 'css.erb'], source: 'source.css' },
    { name: 'basic', language: 'html', identifiers: ['html', 'htm', 'shtml', 'xhtml', 'inc', 'tmpl', 'tpl'], source: 'text.html.basic' },
    { name: 'ini', language: 'ini', identifiers: ['ini', 'conf'], source: 'source.ini' },
    { name: 'java', language: 'java', identifiers: ['java', 'bsh'], source: 'source.java' },
    { name: 'lua', language: 'lua', identifiers: ['lua'], source: 'source.lua' },
    { name: 'makefile', language: 'makefile', identifiers: ['Makefile', 'makefile', 'GNUmakefile', 'OCamlMakefile'], source: 'source.makefile' },
    { name: 'perl', language: 'perl', identifiers: ['perl', 'pl', 'pm', 'pod', 't', 'PL', 'psgi', 'vcl'], source: 'source.perl' },
    { name: 'r', language: 'r', identifiers: ['R', 'r', 's', 'S', 'Rprofile'], source: 'source.r' },
    { name: 'ruby', language: 'ruby', identifiers: ['ruby', 'rb', 'rbx', 'rjs', 'Rakefile', 'rake', 'cgi', 'fcgi', 'gemspec', 'irbrc', 'Capfile', 'ru', 'prawn', 'Cheffile', 'Gemfile', 'Guardfile', 'Hobofile', 'Vagrantfile', 'Appraisals', 'Rantfile', 'Berksfile', 'Berksfile.lock', 'Thorfile', 'Puppetfile'], source: 'source.ruby' },
    // 	Left to its own devices, the PHP grammar will match HTML as a combination of operators
    // and constants. Therefore, HTML must take precedence over PHP in order to get proper
    // syntax highlighting.
    { name: 'php', language: 'php', identifiers: ['php', 'php3', 'php4', 'php5', 'phpt', 'phtml', 'aw', 'ctp'], source: ['text.html.basic', 'source.php'] },
    { name: 'sql', language: 'sql', identifiers: ['sql', 'ddl', 'dml'], source: 'source.sql' },
    { name: 'vs_net', language: 'vb', identifiers: ['vb'], source: 'source.asp.vb.net' },
    { name: 'xml', language: 'xml', identifiers: ['xml', 'xsd', 'tld', 'jsp', 'pt', 'cpt', 'dtml', 'rss', 'opml'], source: 'text.xml' },
    { name: 'xsl', language: 'xsl', identifiers: ['xsl', 'xslt'], source: 'text.xml.xsl' },
    { name: 'yaml', language: 'yaml', identifiers: ['yaml', 'yml'], source: 'source.yaml' },
    { name: 'dosbatch', language: 'bat', identifiers: ['bat', 'batch'], source: 'source.batchfile' },
    { name: 'clojure', language: 'clojure', identifiers: ['clj', 'cljs', 'clojure'], source: 'source.clojure' },
    { name: 'coffee', language: 'coffee', identifiers: ['coffee', 'Cakefile', 'coffee.erb'], source: 'source.coffee' },
    { name: 'c', language: 'c', identifiers: ['c', 'h'], source: 'source.c' },
    { name: 'cpp', language: 'cpp', identifiers: ['cpp', 'c\\+\\+', 'cxx'], source: 'source.cpp' },
    { name: 'diff', language: 'diff', identifiers: ['patch', 'diff', 'rej'], source: 'source.diff' },
    { name: 'dockerfile', language: 'dockerfile', identifiers: ['dockerfile', 'Dockerfile'], source: 'source.dockerfile' },
    { name: 'git_commit', identifiers: ['COMMIT_EDITMSG', 'MERGE_MSG'], source: 'text.git-commit' },
    { name: 'git_rebase', identifiers: ['git-rebase-todo'], source: 'text.git-rebase' },
    { name: 'go', language: 'go', identifiers: ['go', 'golang'], source: 'source.go' },
    { name: 'groovy', language: 'groovy', identifiers: ['groovy', 'gvy'], source: 'source.groovy' },
    { name: 'pug', language: 'pug', identifiers: ['jade', 'pug'], source: 'text.pug' },

    { name: 'js', language: 'javascript', identifiers: ['js', 'jsx', 'javascript', 'es6', 'mjs'], source: 'source.js' },
    { name: 'js_regexp', identifiers: ['regexp'], source: 'source.js.regexp' },
    { name: 'json', language: 'json', identifiers: ['json', 'json5', 'sublime-settings', 'sublime-menu', 'sublime-keymap', 'sublime-mousemap', 'sublime-theme', 'sublime-build', 'sublime-project', 'sublime-completions'], source: 'source.json' },
    { name: 'jsonc', language: 'jsonc', identifiers: ['jsonc'], source: 'source.json.comments' },
    { name: 'less', language: 'less', identifiers: ['less'], source: 'source.css.less' },
    { name: 'objc', language: 'objc', identifiers: ['objectivec', 'objective-c', 'mm', 'objc', 'obj-c', 'm', 'h'], source: 'source.objc' },
    { name: 'swift', language: 'swift', identifiers: ['swift'], source: 'source.swift' },
    { name: 'scss', language: 'scss', identifiers: ['scss'], source: 'source.css.scss' },

    { name: 'perl6', language: 'perl6', identifiers: ['perl6', 'p6', 'pl6', 'pm6', 'nqp'], source: 'source.perl.6' },
    { name: 'powershell', language: 'powershell', identifiers: ['powershell', 'ps1', 'psm1', 'psd1'], source: 'source.powershell' },
    { name: 'python', language: 'python', identifiers: ['python', 'py', 'py3', 'rpy', 'pyw', 'cpy', 'SConstruct', 'Sconstruct', 'sconstruct', 'SConscript', 'gyp', 'gypi'], source: 'source.python' },
    { name: 'regexp_python', identifiers: ['re'], source: 'source.regexp.python' },
    { name: 'rust', language: 'rust', identifiers: ['rust', 'rs'], source: 'source.rust' },
    { name: 'scala', language: 'scala', identifiers: ['scala', 'sbt'], source: 'source.scala' },
    { name: 'shell', language: 'bash', identifiers: ['shell', 'sh', 'bash', 'zsh', 'bashrc', 'bash_profile', 'bash_login', 'profile', 'bash_logout', '.textmate_init'], source: 'source.shell' },
    { name: 'ts', language: 'typescript', identifiers: ['typescript', 'ts'], source: 'source.ts' },
    { name: 'tsx', language: 'tsx', identifiers: ['tsx'], source: 'source.tsx' },
    { name: 'csharp', language: 'csharp', identifiers: ['cs', 'csharp', 'c#'], source: 'source.cs' },
    { name: 'fsharp', language: 'fsharp', identifiers: ['fs', 'fsharp', 'f#'], source: 'source.fsharp' },
    { name: 'dart', language: 'dart', identifiers: ['dart'], source: 'source.dart' },
    { name: 'handlebars', language: 'handlebars', identifiers: ['handlebars', 'hbs'], source: 'text.html.handlebars' },
    { name: 'markdown', language: 'markdown', identifiers: ['markdown', 'md'], source: 'text.html.markdown' },
];
