import {writable} from 'svelte/store';
import Automerge from 'automerge';

if (typeof trikeQuit !== 'undefined' || trikeQuit !== null) {
  document.addEventListener('keypress', e => {
    if (e.metaKey && e.key === 'q') {
      trikeQuit();
    }
  });
}

const createDatastore = () => {
  let actorId;

  const {subscribe, set, update: raw_update} = writable();

  // sync request to get our machine specific id (which we use as automerge actorid)
  var request = new XMLHttpRequest();
  request.open('GET', '/data/__id__', false);
  request.send(null);

  if (request.status === 200) {
    actorId = JSON.parse(request.responseText).id;
  }

  const addWatcher = () => {
    var events = new EventSource('/');

    events.addEventListener('data', e => {
      let data = JSON.parse(e.data);
      if (data.op === 'REMOVE') {
        // do nothing, automerge is ok
      } else {
        // FIXME(ja): the json is currently double escaped due to being contained inside a event stream data blob
        // FIXME(ja): should the eventstream just send metadata, then request data if wanted?
        if (data.id !== actorId) {
          console.log('merging database from', data.id);
          const other_db = Automerge.load(data.value);
          // FIXME(ja): for some reasons sometimes Automerge.merge fails but switching order of arguments succeeds...
          // @PVH says it is probably a bug, I need to get a minimal repro and file the bug!
          update(db => Automerge.merge(other_db, db));
        }
      }
    });
  };

  // FIXME(ja): the way we get our initial data blob is horrible
  // either no document exists, and we should create one or something is wrong?
  // !!!! make creation of a new doc explicit !!!!
  fetch(`/data/${actorId}`)
    .then(r => r.json())
    .catch(
      e =>
        '["~#iL",[["~#iM",["ops",["^0",[["^1",["action","makeList","obj","31859d8e-cb9b-48ad-9a5e-3eb28e5e0ce0"]],["^1",["action","link","obj","00000000-0000-0000-0000-000000000000","key","todos","value","31859d8e-cb9b-48ad-9a5e-3eb28e5e0ce0"]]]],"actor","90f202b1-edde-45be-be5f-c171f75acbde","seq",1,"deps",["^1",[]],"message","Initialization","undoable",false]]]]'
    )
    .then(json => Automerge.load(json, actorId))
    .then(set)
    .then(addWatcher);

  const update = fn => {
    raw_update(db => {
      const new_db = fn(db);
      fetch(`/${actorId}`, {
        method: 'POST',
        body: JSON.stringify(Automerge.save(new_db)),
      });
      return new_db;
    });
  };

  // TODO(ja): explore using automerge.table?
  return {
    subscribe,
    add: newDoc => {
      update(db => {
        const id = uuid();
        return Automerge.change(db, `add ${id}`, doc => {
          doc.todos.push({...newDoc, id});
        });
      });
    },
    delete: id => {
      update(db => {
        const idx = db.todos.findIndex(todo => todo.id === id);
        if (idx === -1) return db;
        return Automerge.change(db, `delete ${id}`, doc => {
          delete doc.todos[idx];
        });
      });
    },
    // NOTE(ja): for automerge you want the changes to be as compact as possible
    // hence having specific APIs for description/completed. We could have a generic
    // update
    update_description: (id, description) => {
      update(db => {
        const idx = db.todos.findIndex(todo => todo.id === id);
        if (idx === -1) return db;
        return Automerge.change(db, `new desc ${id}`, doc => {
          doc.todos[idx].description = description;
        });
      });
    },
    update_completed: (id, completed) => {
      update(db => {
        const idx = db.todos.findIndex(todo => todo.id === id);
        if (idx === -1) return db;
        return Automerge.change(db, `new status ${id}`, doc => {
          doc.todos[idx].completed = !!completed;
        });
      });
    },
  };
};

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const datastore = createDatastore();
