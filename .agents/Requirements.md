# Application requirements

This repo was just bootstrapped with `vite` and setup with React with Typescript.

I want to create a new application called "Set Me Up"  that will take a setlist from setlist.fm and create a Spotify playlist based on an actual playlist, as best as possible.  In some cases, a song may not be available on Spotify, in which case it can be skipped.

## Technical Requirements

1. Name the play list based on the Arist name and the date.  For example, for the band "Pearl Jam" had a setlist from Aug, 29 2024, the play list should be called "Pearl Jam set from 2024-08-29"
2. Attempt to find a live version of the song if possible
3. If the band played a cover song, attempt to find a live version by the band covering the song. For example, Dave Matthews Band often covers Bob Dylan's "All Along the Watchtower" and there are live versions available on Spotify.  If there is no cover version by the band on Spotify, get the original version.
4. Put the songs in the same order as the set
5. A user must authorize with their spotify credentials as the API calls will be made on behalf of them to search and create the list


## User Interface

Create a landing screen that has the app title "Set Me Up!" and explains the purpose of the site, "Create a Spotify playlist based on a live show set list from setlist.fm"  Then have a button that says "Authenticate with Spotify"

After users logs and and is redirected back to the page, the JWT will need to be stored in session storage.  On the screen, have a text input box for user to paste in a set list URL, eg: https://www.setlist.fm/setlist/pearl-jam/2024/wrigley-field-chicago-il-5baa4330.html

Then have a button that says "Set me up!"

After the user clicks the button, have an animation pop up that is of a record spinning (file is in public/record.jpeg).  

Once the playlist has been created, display a link to the Spotify play list, and then below it, have the track listing of the playlist

## Technical Details

Spotify API authorization: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

Search API https://developer.spotify.com/documentation/web-api/reference/search

Create Playlist API https://developer.spotify.com/documentation/web-api/reference/create-playlist

Add items to playlist API https://developer.spotify.com/documentation/web-api/reference/add-items-to-playlist

The webpage will need to be screen scraped.   The setlist will be within a <div> with the class "setlistList".  Each track will be within a <li> with the class "setlistParts song" and within that there is a hyperlink <a> with class "songLabel" that will have the track title.