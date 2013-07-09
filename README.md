# Manta Browser Uploads

This is a small application that illustrates how to use
[CORS](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing), Manta
signed URLs and Ajax in order to upload files directly to
[Manta](https://www.joyent.com/products/manta). Doing this allows you to bypass
your own servers to save on bandwidth.

# Setup

The only dependency this application has is `manta`:

    npm install manta

Then

    npm start

Will get you going. Point your browser at
[http://127.0.0.1:1234](http://127.0.0.1:1234/index.html).

# Details

There are really two parts to this: the server and "webapp".  In this particular
example, the webapp is a very simple single page, that does rely on JQuery.  The
code is all commented, but the basic gist is:


    User -------------------- Server --------------------------Manta
     |                         |                                 |
     |---- Initial Visit ----> |                                 |
     |                         |  ---- mkdir ~/stor/dropbox ---->|
     |<---- Send HTML ----     |                                 |
     |                         |                                 |
     |   Select File           |                                 |
     |                         |                                 |
     |-- Request Signature --->|                                 |
     |                         | ---- mkdir $session ----------->|
     |<--- Send Signature -----|                                 |
     |                         |                                 |
     | ------------------------------ Upload to Manta ---------->|
     |                         |                                 |
     +-------------------------+---------------------------------+

# License

BSD, I guess, because that's the npm default.  Honestly, I don't really care.
Do whatever you want with this.
