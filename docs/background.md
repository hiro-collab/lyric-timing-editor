# Project Background

Lyric Timing Editor started as `Lyric Timing Workbench`, an optional tool inside the Music Effect repository.

The tool became useful enough to stand on its own: its main responsibility is creating and editing lyric timing JSON, while Music Effect and other systems only need the completed JSON file. Because of that boundary, this repository is split out as a standalone public project.

The original prototype commits in Music Effect were:

- `cfeeed4 Add lyric timing workbench`
- `e21748b Fix lyric stage grid placement`

This repository starts from those files as an independent initial version. Future work should treat this repository as the source of truth for the editor.
