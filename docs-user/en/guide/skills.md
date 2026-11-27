# Skills

Skills are pi resources. A skill is a folder with a `SKILL.md` file and
optional scripts, references, and assets. pi lists each skill name and
description in the system prompt, then loads the full instructions when a
task matches.

PiS does not implement a second skill loader. It reads pi's configuration and
shows the loaded skills; pi loads and uses them.

## Where pi finds skills

Common locations:

```text
<pi agent dir>/skills/       user level, usually ~/.pi/agent/skills
~/.agents/skills/            Agent Skills user directory
<project>/.pi/skills/        project level
<project>/.agents/skills/    Agent Skills project directory
```

pi also reads ancestor `.agents/skills` directories up to the repository
root, paths in the `skills` list in `settings.json`, and skills inside
installed packages.

Project skills load only after you trust the project. Review the project's
`.pi/skills` and `.agents/skills` folders from the trust dialog or in the file
manager before trust; a skill can instruct the model to run programs. Before
trust, the Pi configuration dialog lists project-configured paths but does not
read them.

## Review and add skills

Open Settings → Pi resources → Models, providers, skills….

The Skills list shows the name, description, path, and source of each skill.
The sources are:

- `user`: pi's user skills folder.
- `agents`: the global `~/.agents/skills` directory.
- `project`: a project or ancestor folder that loads after trust.
- `configured`: a path from `settings.json`.

To add a skill, enter the path to a skill file or folder and click Add skill
path. A configured file can be a `SKILL.md` or a standalone Markdown skill.
PiS writes the path to the `skills` list in pi's user `settings.json`.
A relative path resolves from pi's agent directory.

To remove a path that you configured, click the remove button. Auto-discovered
skills do not have a remove button. To stop loading one, delete or move its
folder.

## Use a skill

pi decides when to load a skill. To force one, type:

```text
/skill:<name> <optional request>
```

For example:

```text
/skill:repo-docs update the README
```

PiS sends the text to pi. The skill command appears in the composer command
menu when pi reports it.

## Reload

Skills load at session start. After you add, remove, or edit a skill:

1. Close the session.
2. Open the session again.

`/reload` in pi also reloads skills during an active session.

## Next

- [Extensions](/guide/extensions): add tools and commands.
- [Models and sign-in](/guide/models): choose the model.
- [Settings](/guide/settings): review pi resources.
