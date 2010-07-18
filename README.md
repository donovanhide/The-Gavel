Requires [node.js](http://nodejs.org/) to run the backend

  cd /usr/local/src
  sudo git clone http://github.com/ry/node.git
  cd node
  sudo ./configure && make && make install

and then

  node server.js

will run the server.

To host the html locally, I do:

  cd public
  python -m SimpleHTTPServer
