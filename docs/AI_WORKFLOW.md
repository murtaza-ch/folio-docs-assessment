# AI workflow

I used Claude Code for the interface design and Codex for implementation, integration, testing and documentation. I own the architecture, technical decisions and final result.

## Tools and skills

| Tool or skill                   | How I used it                                                              |
| ------------------------------- | -------------------------------------------------------------------------- |
| Claude Code                     | Design direction, workspace layout, sign-in and dialog styling             |
| Codex                           | Backend and feature implementation, code review, checks and deployment     |
| Multiple subagents              | Parallel frontend, backend, authentication, collaboration and export tasks |
| frontend-design                 | Consistent typography, spacing, responsive layouts and usable controls     |
| unslop                          | Remove generic AI phrasing and simplify interface copy and documentation   |
| PDF skill                       | Generate and visually inspect PDFs for readable layout and font handling   |
| Browser tools and official docs | Check actual UI behavior and current Next.js, Chakra and editor APIs       |

## Workflow and verification

I adjusted subagent tasks as the scope changed, shared TypeScript contracts and reviewed integration between tasks. Parallel implementation sped up feature delivery; I kept architecture and scope decisions under my control.

I changed or rejected generated output when it introduced duplicate editor extensions, weak save guards, unbounded history, awkward dialog behavior or truncated dropdown labels. I used Chakra Select and corrected its sizing and dialog positioning.

I verified the result with TypeScript, 80 automated tests, production builds, HTTP flows and desktop/mobile browser checks. I checked PDF output visually and treated deployed behavior as separate evidence from unit tests. The [report](../SUBMISSION.md) records limits and incomplete work.
