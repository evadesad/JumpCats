# Exit Window

A static, GitLab Pages-ready skydiving weather dashboard. It reads Windy Point Forecast data for a selected dropzone and presents a conservative, configurable **site-policy** assessment for USPA A–D license holders.

## Run

Open `index.html` in a modern browser, or serve the folder with any static web server.

Open **Weather connection** and enter a Windy Point Forecast API key. Obtain one at [Windy API](https://api.windy.com/point-forecast/docs). The app sends a browser `POST` directly to Windy; do not treat a key in a static GitLab Pages app as a secret.

Dropzones are discovered from OpenStreetMap's Overpass service; a small fallback list keeps the selection usable when its public endpoint is unavailable.

## Publish to GitLab Pages

Push this repository to GitLab and let the included `.gitlab-ci.yml` run on the default branch. The pipeline publishes the static `public/` folder to Pages.

## Safety

This is planning support, not an operational release. USPA A–D licences are qualifications, **not universal wind-limit categories**. The initial limits are deliberately editable site-policy defaults. The S&TA/dropzone operator, pilot and jumper remain responsible for go/no-go decisions. Students and recent graduates must use their DZ/USPA instructor limits.
