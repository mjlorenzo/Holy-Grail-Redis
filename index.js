var express = require("express");
var app = express();

// import the redis library and create a client
let redis = require("redis");
let redisClient = redis.createClient();

// serve static files from public directory
app.use(express.static("public"));

// constant array of our database keys
// makes sure we're requesting data in the same format every time
const dbGetArray = ["header", "left", "right", "article", "footer"];

// initialize values for: header, left, right, article and footer using the redis client
redisClient.mset("header", 0, "left", 0, "right", 0, "article", 0, "footer", 0);
redisClient.mget(dbGetArray, (err, data) => {
  console.log(data);
});

// Get values for holy grail layout
function data() {
  // use a Promise wrapper to handle async DB access
  return new Promise((resolve, reject) => {
    redisClient.mget(dbGetArray, (err, data) => {
      // check for error, reject if so
      if (err) {
        reject(err);
        return;
      }

      // this formats the output data as key/value pairs for the front-end
      let temp = {};
      // loop over the requested data, populating temp with key/value pairs
      // allows us to change the data at will without breaking this function
      for (let i = 0; i < dbGetArray.length; i++) {
        temp[dbGetArray[i]] =  data[i];
      }
      // resolve the Promise with our data
      resolve(temp);
    });
  });
}

// route to update a particular key
// PATCH was chosen because it does not guarantee idempotency
app.patch("/update/:key/:value", function (req, res) {
  // grab our URL parameters
  const key = req.params.key;
  let value = Number(req.params.value);

  // fetch the current data from the DB
  // then update and respond with new data
  data().then(data => {
    // check if the chosen section exists
    if (!data[key]) {
      // if not, tell the client the resource was not found
      res.sendStatus(404);
      return;
    }

    // convert old value from a String
    let oldValue = Number(data[key]);
    // add value (1 or -1)
    data[key] = oldValue + value;
    // data() returns an Object mapping each section to its value
    // we can convert this into ordered key/value pairs by first calling
    // Object.entries() on the data, then calling Array.prototype.flat() to
    // remove the nested key/value arrays
    // this formats the data correctly for the MSET command
    redisClient.mset(Object.entries(data).flat());
    // respond with the new data
    res.send(data);
  })
});

// get key data
app.get("/data", function (req, res) {
  data().then((data) => {
    res.send(data);
  });
});

app.listen(3000, () => {
  console.log("Running on 3000");
});

// release DB client on process exit
process.on("exit", function () {
  client.quit();
});
