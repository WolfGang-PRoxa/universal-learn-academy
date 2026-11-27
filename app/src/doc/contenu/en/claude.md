# Claude, ChatGPT and Gemini

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

## ChatGPT or Gemini instead of Claude

[Settings › AI assistant](parametres:assistant) chooses the quiz assistant: **Claude**, **ChatGPT** or **Gemini**. Each goes through its publisher’s official command-line tool, which must be installed on the computer (with Node.js):

| Assistant | Tool                                             | Account sign-in                                                                        | API key                  |
| --------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------ |
| ChatGPT   | Codex CLI (`npm install -g @openai/codex`)       | **Sign in…** opens a terminal on `codex login`: sign in with a ChatGPT plan, at OpenAI | OpenAI key, billed to it |
| Gemini    | Gemini CLI (`npm install -g @google/gemini-cli`) | **Sign in…** opens Gemini CLI: choose “Sign in with Google”, then close the terminal   | Google AI Studio key     |

The [Connection to ChatGPT](parametres:chatgpt) and [Connection to Gemini](parametres:gemini) cards work like Claude’s: tool and account status, sign-in, sign-out, key encrypted by the system. They also set the model (the same for every use; empty, the account’s default) and the tool’s path. With ChatGPT, each use’s effort sets the reasoning effort.

In quizzes and TDs, the assistant’s name (top bar, conversation panel, workshop button) is a button: its small menu switches assistant on the spot, or opens the settings of any of them (gear).

> **Note** As with Claude, the application collects no credentials or tokens: sign-in happens in the tool, at the publisher. A saved key or a mode change applies when the application restarts.

## If the assistant does not answer

1. Check in [Settings › Claude](parametres:claude) (or the ChatGPT or Gemini card) that the tool is detected and connected (**Check again**).
2. In account mode, use **Sign in…** again if the session has expired.
3. In key mode, check that the key is still valid and has credit.

See also [Troubleshooting](page:depannage).
