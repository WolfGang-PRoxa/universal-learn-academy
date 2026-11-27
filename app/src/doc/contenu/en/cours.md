# Courses, curriculum and quizzes

## The home page

The home page (**Alt+Home**, or the house button of the top bar) gathers:

| Section          | Content                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profiles (panel) | On the left: profiles, switching profiles, creating, renaming and deleting (by retyping the profile name). The ☰ button of the top bar folds the panel |
| My curriculum    | The curriculum’s folders and their courses, with each one’s progress                                                                                    |
| Catalogue        | Two tabs: **Installed on this computer** (by domain) and **All courses** (sample curricula, packs, courses to download)                                 |
| Tools            | Revisions, C compilation, Python notebooks, demos                                                                                                       |

## The curriculum

The curriculum is a free tree of folders: L1, L2, Prep, Personal… Each course in it is a **link** to the installed course, not a copy. Progress is stored next to the link, so the same course can be in “L2” for one profile and in “Reorientation” for another.

The **⋯** button of a folder or a course opens its actions:

- **Add a course…** and **New subfolder…** (folders);
- **Rename…** and **Move…**;
- **Remove…**: a course that contains work cannot be removed and should be moved instead; only an empty folder can be removed;
- **Open the folder** in the file explorer.

A curriculum course that is not installed yet shows “to download”: one click downloads it. **Download all** fetches every missing course at once.

## The catalogue

- **Sample curricula**: several packs arranged in folders. **Add to my curriculum…** creates the folders and the links; whatever already exists stays in place.
- **Packs**: all the courses of a level. **Download the pack** installs them one by one; a failing course does not stop the others, and running the pack again only retries the missing ones. **Place in my curriculum…** adds them to a folder.
- **Courses**: each course can be downloaded, updated (“Update available”) or deleted. Deleting removes the course pages, never the work.

## The contents panel

In course and quiz pages, the left panel (contents) collapses and expands with the first button of the top bar, on the left; the page then takes the full width. The choice is kept from one page to the next. On a narrow screen, the same button opens the contents over the page. The documentation and the settings have the same button.

## Quizzes, tutorials and labs

- **Quizzes**: multiple choice, written answers, code, SQL… Every attempt is saved. In practice mode, any question can be reached at any time: the numbered dots and the ‹ › arrows lead to any question, **Skip** leaves a question for later, and the colour of each dot shows its state (to do, answered, right, partial, wrong). With an [AI assistant](page:claude) (Claude, ChatGPT or Gemini), help is available during the quiz and written answers are corrected.
- **Interactive tutorials**: exercises are done right in the page (code editors, tables, diagrams). The work is saved as it goes in the profile’s folder.
- **Labs**: provided files are in the course; the work is done in the course’s folder of the profile’s space.

**My revisions** (**Go** menu) gathers the quizzes to resume, the results and the tutorials of the curriculum’s courses.

## Proposing a course

A course created in a profile’s space can be submitted to the catalogue: **⋯ › Submit this course…**, or from its card in the **My courses** tab of the catalogue (home page), which gathers personal courses and the status of their submission. The form takes the course card and what the application measured of its generation (AI, model, effort, duration, resources read); you add what was done outside the application (AI, model, effort, time spent, resources), an optional pseudonym, and accept the CC BY-NC-ND 4.0 licence.

The course is then checked on the computer, step by step: files (only the generated pages, no personal data), generation details, page guidelines, quizzes, workshops, archive. A small box at the bottom right follows the progress; one click minimises it to a badge.

If a check fails, or cannot run (Python missing), the submission is **suspended**: nothing is sent. In **My submissions** (home page), three choices: **Fix with my AI** (the AI fixes the reported problems, then the check starts again), **I fixed it: check again**, or **Cancel the submission**. Each submission keeps its full dated history there, its checks and the details sent.

Once the check passes, the submission is sent on its own to the submission service (`ula.romainpiau.dev`), which runs its own checks and gives it a number. Without a network it stays **ready**: **Try sending again** sends it. Then **My submissions** and the box follow its status on the administrator’s side: received, under review, accepted or refused, with their message. The status is read again every 10 minutes, or right away with **Refresh status**.

### Proposing a pack, a curriculum or teachers’ courses

- **Pack**: the **⋯** menu of a My curriculum folder offers **Propose as a pack…** when it holds at least two catalogue courses. The pack takes these courses, with a title, the suggested folder and a description.
- **Curriculum**: **Propose as a curriculum…** on a folder where at least two sub-folders hold courses (L1, L2, L3…); each sub-folder becomes a pack.
- A pack or curriculum only takes catalogue courses: the folder’s personal courses are flagged and left out, to be submitted as courses first. The check reads the online catalogue; without a network, the submission is suspended until **I fixed it: check again**.
- **Teachers’ courses**: in **My courses**, **Propose teachers’ courses…** sends raw files (PDFs, slides, documents, texts, images, code; 50 MB at most) to the administrator so they can generate a course from them. Two declarations are required: having the right to share these documents, and having removed personal information from them. Once the course is generated, its title appears in the submission’s tracking.

### Received submissions (administrator)

With the administration token saved ([Settings › Received submissions](parametres:administration)), the home page shows the **Received submissions** section: to handle, accepted, refused, and a filter by kind (courses, packs, curricula, teachers’ courses) when there are several. For each submission: the course card, what the author’s application measured and what they declared, their checks, and the history.

- **Review** (one submission, the selection, or all those to review) with the AI chosen in the list (Claude, ChatGPT or Gemini, with no fallback to another one): the archive is downloaded to `soumissions-recues/`, the checks run again on this computer, then the AI reads the course without changing anything and gives a recommendation (accept, needs fixes, decline), a summary, specific points and a score. The author sees the recommendation and the summary.
- **Accept**: in repository mode, the course goes into `explore/` (same checks as the catalogue, optional pack); elsewhere, the archive stays in `soumissions-recues/`. A pack or curriculum accepted in repository mode goes into `explore/packs/` or `explore/cursus/` (identifier of your choice). Accepted teachers’ courses stay in `soumissions-recues/`: **Link the generated course…** then tells the author which course came out of them. Only courses are reviewed by the AI. **Refuse** asks for a message for the author. **Block the author** refuses future submissions from their installation.

Nothing is accepted without your decision.
