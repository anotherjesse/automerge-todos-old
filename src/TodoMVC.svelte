<script>
  import {datastore} from './data.js';
  const ENTER_KEY = 13;
  const ESCAPE_KEY = 27;

  let currentFilter = 'all';
  let items = [];
  let editing = null;

  datastore.subscribe(db => {
    if (db && db.todos) items = db.todos;
  });

  const updateView = () => {
    currentFilter = 'all';
    if (window.location.hash === '#/active') {
      currentFilter = 'active';
    } else if (window.location.hash === '#/completed') {
      currentFilter = 'completed';
    }
  };

  window.addEventListener('hashchange', updateView);
  updateView();

  function clearCompleted() {
    items = items.filter(item => !item.completed);
  }

  function remove(id) {
    datastore.delete(id);
  }

  function toggleAll(event) {
    items.forEach(item => {
      if (item.completed !== event.target.checked) {
        datastore.update_completed(item.id, event.target.checked);
      }
    });
  }

  function createNew(event) {
    if (event.which === ENTER_KEY) {
      datastore.add({
        description: event.target.value,
        completed: false,
      });
      event.target.value = '';
    }
  }

  function handleEdit(event) {
    if (event.which === ENTER_KEY) event.target.blur();
    else if (event.which === ESCAPE_KEY) editing = null;
  }

  function submit(event) {
    datastore.update_description(editing, event.target.value);
    editing = null;
  }

  function toggleCompleted(item) {
    datastore.update_completed(item.id, !item.completed);
  }

  $: filtered =
    currentFilter === 'all'
      ? items
      : currentFilter === 'completed'
      ? items.filter(item => item.completed)
      : items.filter(item => !item.completed);

  $: numActive = items.filter(item => !item.completed).length;

  $: numCompleted = items.filter(item => item.completed).length;
</script>

<header class="header">
  <h1>todos</h1>
  <input
    class="new-todo"
    on:keydown={createNew}
    placeholder="What needs to be done?"
    autofocus />
</header>

{#if items.length > 0}
  <section class="main">
    <input
      id="toggle-all"
      class="toggle-all"
      type="checkbox"
      on:change={toggleAll}
      checked={numCompleted === items.length} />
    <label for="toggle-all">Mark all as complete</label>

    <ul class="todo-list">
      {#each filtered as item (item.id)}
        <li
          class="{item.completed ? 'completed' : ''}
          {editing === item.id ? 'editing' : ''}">
          <div class="view">
            <input
              class="toggle"
              type="checkbox"
              checked={item.completed}
              on:click={() => toggleCompleted(item)} />
            <label on:dblclick={() => (editing = item.id)}>
              {item.description}
            </label>
            <button on:click={() => remove(item.id)} class="destroy" />
          </div>

          {#if editing === item.id}
            <input
              value={item.description}
              id="edit"
              class="edit"
              on:keydown={handleEdit}
              on:blur={submit}
              autofocus />
          {/if}
        </li>
      {/each}
    </ul>

    <footer class="footer">
      <span class="todo-count">
        <strong>{numActive}</strong>
        {numActive === 1 ? 'item' : 'items'} left
      </span>

      <ul class="filters">
        <li>
          <a class={currentFilter === 'all' ? 'selected' : ''} href="#/">All</a>
        </li>
        <li>
          <a
            class={currentFilter === 'active' ? 'selected' : ''}
            href="#/active">
            Active
          </a>
        </li>
        <li>
          <a
            class={currentFilter === 'completed' ? 'selected' : ''}
            href="#/completed">
            Completed
          </a>
        </li>
      </ul>

      {#if numCompleted}
        <button class="clear-completed" on:click={clearCompleted}>
          Clear completed
        </button>
      {/if}
    </footer>
  </section>
{/if}
