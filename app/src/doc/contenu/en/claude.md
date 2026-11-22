# Claude

Claude helps during quizzes, corrects written answers, evaluates attempts and generates new quizzes. It goes through **Claude Code**, Anthropic’s command-line tool, which must be installed on the computer. Without it, courses and quizzes work, but without Claude’s help.

## Two ways to connect

The choice is made in [Settings › Claude](parametres:claude).

| Mode                                            | How it works                                                                                                                                                                                    | For whom                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| A Claude account, through Claude Code (default) | The application detects Claude Code and shows the connected account. **Sign in…** opens a terminal where signing in happens on Anthropic’s website: the application never sees the credentials. | With a Claude subscription |
| An Anthropic API key                            | The key is checked with Anthropic, then encrypted by the system and never shown again. Usage is billed to the key.                                                                              | Without a subscription     |

> **Note** A third-party application is not allowed to offer signing in with a claude.ai account or to keep credentials. That is why signing in always happens in Claude Code itself.

## Models and code execution

[Settings › Models](parametres:claude-modeles) sets, for each use (help, correction, evaluation, quiz generation), the model and effort to use. **Test** checks that the setting answers. The same card shows the path to Claude Code and the languages quizzes can run.

## If Claude does not answer

1. Check in [Settings › Claude](parametres:claude) that Claude Code is detected and connected (**Check again**).
2. In account mode, use **Sign in…** again if the session has expired.
3. In key mode, check that the key is still valid and has credit.

See also [Troubleshooting](page:depannage).
