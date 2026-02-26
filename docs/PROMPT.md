# Background

ShotDB is a database of all useful rotation pool shots and a training planner that uses spaced repetition to train a player's skill level for each shot. The introduction to the DB starts with an assessment.

## Assessment columns

These columns are marked by the trainer.

* Comfort level ("Do you know the shot")
* Visualization fidelity ("How clear of a shot picture can you generate?")
* Is the beautiful stroke applied?
* Is the alignment correct?
* Result of the shot
* Real world frequency of the shot
## Heuristics for aggregating the columns

A numerical score ranging from 1 to 5 is produced based on the assessment. 

* if comfort level and visualization fidelity are the lowest, the overall score is the lowest (1).
* if beautiful stroke or alignment was incorrect, the result of the shot doesn't matter.
* finally, the result column will impact the score
* once the player reaches a high skill level (the max?) you switch to maintenance mode, entailing that fewer shots are needed for practice.
* global constraint: reduce overall variance in assessment scores over time

## Tentative algorithm for aggregation

| **Category**           | **Levels**                                                                   | **Numeric** |
| ---------------------- | ---------------------------------------------------------------------------- | ----------- |
| Comfort level          | Unfamiliar (1), Somewhat unfamiliar (2), Somewhat familiar (3), Familiar (4) | 1–4         |
| Visualization fidelity | Unfamiliar (1), Somewhat unfamiliar (2), Somewhat familiar (3), Familiar (4) | 1–4         |
| Beautiful stroke       | No (0), Yes (1)                                                              | binary      |
| Alignment correct      | No (0), Yes (1)                                                              | binary      |
| Result                 | Not good attempt (1), Good attempt (2)                                       | 1–2         |
| Frequency              | Low (1), Medium (2), High (3)                                                | 1–3         |

## Session planning

* assume 90 min session by default, but the session time is configurable
* assume 2 shots per minute
* recommendation is 2 shot types per session. 1 is okay.
* 20 mins for each shot type. if times allows, two 20 + 20 minute sessions per shot.
* assume warm up, cool down, mechanics works that take the first 10 and last 10 minutes of a session
* per shot type
	* come up with instances of this shot
	* 20 mins of same instance first
	* then shoot 20 mins of variants of the shot if time allow

## Rules for arranging a training program

The training program should:
* Prioritize shots with lower aggregate skill level
* Prioritize the shots with higher frequency
* Apply spaced repetition of the shots: make your assumptions about how motor learning is retained explicitly.
* Assume each shot takes around 1 minute
* Be flexible to the time alottment for any given session
* Provide a timer and input form for recording the hsots
* Display diagrams of the shot or allow the trainee to update an image
* Record the shots played and time spent

# The application

The application should be an React application with a minimal backend for data storage if possible.

* Main data
	* Users: a list of users in the system, auth info, etc
	* Shots: each shot has a list of images (at minimum mirrored images for left/right sides), a description for the table setup (text for now but can be a DSL later), and whether these shots are consider in the database, or pending candidates (there could be other tags, might need to be extensible). 
	* Sessions: each session is a series of practice blocks of shots. each block will record attempts and success/fails, and can include other metadata like self-raiting of comfort level, notes, and so on.
	* Assessment: as described above. assessments are done periodically
* Auth: as simple as possible
* UX design: light and dark mode support. should generally feel simple and always prioritize the image of the shot. strong mobile support for daily entry. possible extended admin features when in desktop/tablet. touch event friendly
* Data entry
	* Daily session entry
	* Candidate shot addition
	* Adding variations of existing shots in the database 
	* Viewing the all shots in the database as a gallery
	* Doing assessment as a (self-)trainer
	* Dashboard for previewing and tweaking the program

# Misc

An initial seed data for the shot database can be found in `docs/examples` in this repo.



