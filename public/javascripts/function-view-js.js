function getElementById(id) {
  if (document.getElementById(id) !== null) {
    return document.getElementById(id);
  } else {
    return { onclick: '' };
  }
}

function redirectPost(url, data) {
  var form = document.createElement('form');
  document.body.appendChild(form);
  form.method = 'post';
  form.action = url;
  for (var name in data) {
    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = data[name];
    form.appendChild(input);
  }
  form.submit();
}

window.addEventListener('load', function() {
  var editor1 = ace.edit("editor1");
  editor1.session.setMode("ace/mode/javascript");
  editor1.session.setUseWorker(false);
  editor1.container.style.lineHeight = 1.625;
  editor1.setOptions({
    fontFamily: 'Hack',
    fontSize: '13.5px',
    useSoftTabs: true,
    tabSize: 2,
  });
  var editor2 = ace.edit("editor2");
  editor2.session.setMode("ace/mode/json");
  editor2.session.setUseWorker(false);
  editor2.container.style.lineHeight = 1.625;
  editor2.setOptions({
    fontFamily: 'Hack',
    fontSize: '13.5px',
    useSoftTabs: true,
    tabSize: 2,
  });
  getElementById('btn-editor1').onclick = function() { 
    getElementById('editor1').classList.remove('hidden');
    getElementById('editor2').classList.add('hidden');
    getElementById('btn-editor1').classList.add('active');
    getElementById('btn-editor2').classList.remove('active');
    editor1.focus();
  };
  getElementById('btn-editor2').onclick = function() { 
    getElementById('editor2').classList.remove('hidden');
    getElementById('editor1').classList.add('hidden');
    getElementById('btn-editor2').classList.add('active');
    getElementById('btn-editor1').classList.remove('active');
    editor2.focus();
  };
  getElementById('btn-save-deploy').onclick = function() {
    redirectPost('/ui/function/deploy/' + funcname, {
      eIndex: editor1.getValue(),
      ePackage: editor2.getValue(),
    });
  };
  
  // test area
  
  var host = window.location.href.split('ui/function/view')[0]; // just in case hosted under sub path
  
  getElementById('btn-stop-service').onclick = function() {
    redirectPost('/ui/function/stop/' + funcname);
  };
  
  getElementById('btn-delete-func').onclick = function() {
    redirectPost('/ui/function/delete/' + funcname);
  };
  
  getElementById('btn-run-test').onclick = function() {
    getElementById('output').innerHTML = '';
    getElementById('output-status').innerHTML = '';
    var val = getElementById('query-input').value;
    if (getElementById('query-input').value.substr(0, 1) != '?') {
      val = `?${getElementById('query-input').value}`;
      getElementById('query-input').value = `?${getElementById('query-input').value}`;
    }
    axios.get(`${host}function/${funcname}${val}`)
    .then(function (response) {
      console.log(response);
      getElementById('output').innerHTML = (Object.prototype.hasOwnProperty.call(response.headers, 'content-type') && response.headers['content-type'].indexOf('application/json') != -1)? JSON.stringify(response.data): response.data;
      getElementById('output-status').innerHTML = `${response.status} ${response.statusText} ${(Object.prototype.hasOwnProperty.call(response.headers, 'content-type'))? '- ' + response.headers['content-type']: ''}`;
    })
    .catch(function (error) {
      console.error(error);
      getElementById('output-status').innerHTML = `${error.response.status} ${error.response.statusText}`;
    });
  };
  
}, true);