const express = require('express');

const port = process.env.PORT || 8081;
const app = express();

require('./server/routes')(app)

app.listen(port, (err) => {
  if (err) {
    console.log(err);
  } else {
    console.log('\n>>> Running on port: ' + port);
  }
});
