# Final project - It can sound like a party, privacy - frontend
The main purpose was to build a platform for a choreographic sound artwork to be sent in real time to two users that connect to the site.
The users will receive different audiofiles and voice instructions. 

## Endpoints
The API has the following endpoints 

| METHOD | Path                                      | Description                                                                            |
| :------|------------------------------------------ | --------------------------------------------------------------------------------------:|
| | https://icslap-p.herokuapp.com/                  | Welcome page - contains a list of available routes                                     |
| POST    | /signin                                  | Endpoint for Admin to sign in. |
| POST/GET | /sounds                                 | Endpoint for Admin to post a new audio file, and retrieve a list of all sounds         |
| GET | sounds/play/:user                            | Endpoint to play an audio file |
| DELETE | /sounds/:id                               | Delete an audio file from the admin list page                                          |

## Reflections
If we had more time, what would be next?

-If we had more time we would experiment with a completely different user flow. For example a bigger room with 8 people to start off the session and only after that divide the users into pairs (A, B) (C, D) (E, F), and into smaller rooms. The soundstream would only start when all the users has been divided.
- A chat function where people who are in the same room could chat with each other before the session starts, and after when the session has ended. 
- On the last page we would add a feedback-button to a page where the users can post feedback to us about the platform, as well as about the experience itself :)
- Create PWA that would enable users to at least see the page without the need for WiFi as well as making it downloadable.

## Getting started
Install dependencies with `npm install`, then start the server by running `npm run dev`

### TECH frontend and backend: 
Tech used:
> React
> Redux
> React Router
> MongoDB Cloud Atlas (database hosting)
> Heroku (server hosting)
> Socket.io
> Node 
> Express

## Deployed project
Backend:https://icslap-p.herokuapp.com/
Frontend: https://itcansoundlikeapartyprivacy.netlify.app/


