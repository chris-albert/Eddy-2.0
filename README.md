To install
----------

```
npm install
npm install -g gulp
npm install -g browserfy
npm install -g watchify
npm install http-server -g
//Set up semantic
cd semantic/
gulp build
```

To Run
------
```
# Start http server
http-server
# Watch files to build automatically
watchify js/entry.js -o js/bundle.js -v
```

To see
------
```
http://localhost:8080/
```


