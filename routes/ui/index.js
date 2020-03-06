var fs = require('fs-extra');
var createError = require('http-errors');
var express = require('express');
var request = require('request');
var pm2 = require('pm2');
var portfinder = require('portfinder');
portfinder.basePort = Math.floor(Math.random()*(32768-16384+1)+16384);;
var path = require('path');
var exec = require('child-process-promise').exec;
var router = express.Router();

/**
 * Remove directory recursively
 * @param {string} dir_path
 * @see https://stackoverflow.com/a/42505874/3027390
 */
function rimraf(dir_path) {
    if (fs.existsSync(dir_path)) {
        fs.readdirSync(dir_path).forEach(function(entry) {
            var entry_path = path.join(dir_path, entry);
            if (fs.lstatSync(entry_path).isDirectory()) {
                rimraf(entry_path);
            } else {
                fs.unlinkSync(entry_path);
            }
        });
        fs.rmdirSync(dir_path);
    }
}

const listrunning = (cb) => {
  pm2.connect(() => {
    pm2.list((err, proc) => {
      proc.forEach((elm) => {
        delete elm.pm2_env;
      });
      cb(proc);
    });
  });
}

const render = (res, a, b) => {
  listrunning((p) => {
    const funcs = fs.readdirSync('functions');
    const parsed = [];
    const funcParsed = { online: false };
    const pls = [];
    p.forEach((elm, i) => {
      pls.push(elm.name.split('-')[2]);
    })
    console.log(funcs);
    console.log(pls);
    funcs.forEach((elm, i) => {
      const ati = pls.indexOf(elm);
      if (ati !== -1) {
        parsed.push({
          name: elm,
          online: true,
        });
        if (Object.hasOwnProperty.call(b, 'func') && b.func === elm) funcParsed.online = true;
      } else {
        parsed.push({
          name: elm,
          online: false,
        });
      }
    })
    b.sidebar = parsed;
    b.funcParsed = funcParsed;
    res.render(a, b);
  });
};

router.get('/function/:name', (req, res, next) => {
  listrunning((p) => {
    let pls = [];
    let pat = -1;
    // add auto deploy
    p.forEach((elm, i) => {
      pls.push(elm.name);
      if (elm.name.split("-")[2] === req.params.name) pat = i;
    });
    if (pat != -1) {
      const url = `http://localhost:${pls[pat].split("-")[1]}/`;
      req.pipe(request({ 
        qs: req.query,
        uri: url })).pipe(res);
    } else {
      next(createError(404));
    }
  });
});

router.get('/ui/', (req, res, next) => {
  render(res, 'index', { title: 'Home' });
});

router.get('/ui/function/new', (req, res, next) => {
  render(res, 'function-new', { title: 'Create Function'});
});

router.post('/ui/function/stop/:name', (req, res, next) => {
  pm2.connect((err) => {
    pm2.list((err, p) => {
      let pls = [];
      let pat = -1;
      p.forEach((elm) => {
        delete elm.pm2_env;
      });
      p.forEach((elm, i) => {
        pls.push(elm.name);
        if (elm.name.split("-")[2] === req.params.name) pat = i;
      });
      if (pat != -1) {
        pm2.delete(`func-${pls[pat].split("-")[1]}-${req.params.name}`);
      }
    });
  });
  res.redirect('/ui');
});

router.post('/ui/function/delete/:name', (req, res, next) => {
  pm2.connect((err) => {
    pm2.list((err, p) => {
      let pls = [];
      let pat = -1;
      p.forEach((elm) => {
        delete elm.pm2_env;
      });
      p.forEach((elm, i) => {
        pls.push(elm.name);
        if (elm.name.split("-")[2] === req.params.name) pat = i;
      });
      if (pat != -1) {
        pm2.delete(`func-${pls[pat].split("-")[1]}-${req.params.name}`);
      }
      // ^ stop
      rimraf(`functions/${req.params.name}`);
      res.redirect('/ui');
    });
  });
});

router.post('/ui/function/deploy/:name', (req, res, next) => {
  portfinder.getPortPromise().then((port) => {
    fs.writeFileSync(`functions/${req.params.name}/editable-index.js`, req.body.eIndex);
    fs.writeFileSync(`functions/${req.params.name}/editable-package.json`, req.body.ePackage);
    const ePackage = JSON.parse(req.body.ePackage);
    ePackage.dependencies['micro'] = 'latest';
    ePackage.dependencies['micro-query'] = 'latest';
    ePackage.dependencies['vm2'] = 'latest';
    fs.writeFileSync(`functions/${req.params.name}/package.json`, JSON.stringify(ePackage));
    fs.writeFileSync(`functions/${req.params.name}/func.js`, req.body.eIndex);
    fs.writeFileSync(`functions/${req.params.name}/index.js`, 
      `var func = require('./func.js');
      var query = require('micro-query');
      module.exports = (req, res) => {
        req.query = query(req);
        res.send = function (httpcode, data) {
          require('micro').send(res, httpcode, data);
        };
        func.main(req, res);
      };
    `);
    fs.writeFileSync(`functions/${req.params.name}/start.js`, 
      `var micro = require('micro');
      var i = require('./index.js');

      var server = micro(i);
      server.listen(${port});
    `);

    exec('yarn install', {
      cwd: `${path.join(req.app.locals.basedir, 'functions', req.params.name)}`,
    }).then((result) => {
      pm2.connect((err) => {
        pm2.list((err, p) => {
          let pls = [];
          let pat = -1;
          p.forEach((elm) => {
            delete elm.pm2_env;
          });
          p.forEach((elm, i) => {
            pls.push(elm.name);
            if (elm.name.split("-")[2] === req.params.name) pat = i;
          });
          if (pat != -1) {
            pm2.restart(`func-${pls[pat].split("-")[1]}-${req.params.name}`);
          } else {
            pm2.start(`${path.join(req.app.locals.basedir, 'functions', req.params.name, 'start.js')}`, {
              name: `func-${port}-${req.params.name}`,
            });
          }
        });
      });
      res.redirect('/ui');
    }).catch((err) => {
      console.error('ERROR: ', err);
    });
  }).catch((err) => {
      // 
      // Could not get a free port, `err` contains the reason. 
      // 
  });
});

router.get('/ui/function/view/:name', (req, res, next) => {
  const eIndex = fs.readFileSync(`functions/${req.params.name}/editable-index.js`);
  const ePackage = fs.readFileSync(`functions/${req.params.name}/editable-package.json`);
  render(res, 'function-view', { 
    title: `Editing ${req.params.name}`,
    func: req.params.name, 
    eIndex,
    ePackage,
  });
});

router.post('/ui/function/create', async (req, res, next) => {
  await fs.mkdir(`functions/${req.body.name}`);
  await fs.writeFile(`functions/${req.body.name}/editable-index.js`, 
`/**
* Access query via req.query['key']
**/
exports.main = (req, res) => {
  res.send(200, 'Hello World!');
}`);
  await fs.writeFile(`functions/${req.body.name}/package.json`, '');
  await fs.writeFile(`functions/${req.body.name}/editable-package.json`, 
`{
  "name": "${req.body.name}",
  "dependencies": {}
}`);
  res.redirect('/ui');
});

module.exports = router;
