'use strict';
'require view';
'require form';
'require ui';
'require fs';

// Helper (sub)functions
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const isValidConfig = (config) => {
    try {
      JSON.parse(config);
      if (config.includes("{}")) return false;
      return true;
    } catch {
      return false;
    }
  };

const notify = (type, msg) => ui.addNotification(null, msg, type);

const getInputValueByKey = (key) => {
  const id = `widget.cbid.singb.main.${key}`;
  return document.querySelector(`#${CSS.escape(id)}`)?.value.trim();
};

async function loadFile(path) {
  try {
    return (await fs.read(path)) || '';
  } catch {
    return '';
  }
}

async function saveFile(path, value, message = 'Saved!') {
  try {
    await fs.write(path, value);
    notify('info', message);
  } catch (e) {
    notify('error', 'Error: ' + e.message);
  }
}

async function getStatus() {
  try {
    const res = await fs.exec('/etc/init.d/sing-box', ['status']);
    return res.stdout.trim().toLowerCase();
  } catch {
    return 'error';
  }
}

function createServiceButton(section, action, status) {
  const shouldShow =
    (action === 'start' && status !== 'running') ||
    (['stop', 'restart', 'reload'].includes(action) && status === 'running');
  if (!shouldShow) return;

  const btn = section.taboption('service', form.Button, action, action.charAt(0).toUpperCase() + action.slice(1));
  btn.inputstyle = (action === 'stop') ? 'remove' : (action === 'start') ? 'positive' : 'apply';
  btn.onclick = async () => {
    try {
      await fs.exec('/etc/init.d/sing-box', [action]);
      notify('info', `${action} successful`);
      setTimeout(() => location.reload(), 500);
    } catch (e) {
      setTimeout(() => location.reload(), 500);
      notify('error', `${action} failed: ${e.message}`);
    }
  };
}

function createSaveUrlButton(section, tabName, config) {
  const key = `subscribe_url_${config.name}`;
  const btn = section.taboption(tabName, form.Button, `save_url_${config.name}`, 'Save URL');
  btn.inputstyle = 'positive';
  btn.onclick = async () => {
    const url = getInputValueByKey(key);
    if (!url) return notify('error', 'Empty URL field');
    if (!isValidUrl(url)) return notify('error', 'Invalid URL');
    await saveFile(`/etc/sing-box/url_${config.name}`, url, 'URL saved');
  };
}

function createUpdateConfigButton(section, tabName, config) {
  const btn = section.taboption(tabName, form.Button, `update_${config.name}`, 'Update Config');
  btn.inputstyle = 'reload';
  btn.onclick = async () => {
    try {
      const url = (await loadFile(`/etc/sing-box/url_${config.name}`)).trim();
      if (!url) throw new Error('URL is empty');
      const result = await fs.exec('/usr/bin/singb/singb-updater', [
        `/etc/sing-box/url_${config.name}`,
        `/etc/sing-box/${config.name}`
      ]);
      if (result.code !== 0) throw new Error(result.stderr || result.stdout || 'Unknown error');

      if (config.name === 'config.json') {
        await fs.exec('/etc/init.d/sing-box', ['reload']);
        notify('info', 'Config reloaded');
        setTimeout(() => location.reload(), 1000);
      } else {
        notify('info', 'Config updated');
        setTimeout(() => location.reload(), 1500);
      }
    } catch (e) {
      notify('error', 'Update failed: ' + e.message);
    }
  };
}

function createSaveContentButton(section, tabName, config) {
  const key = `content_${config.name}`;
  const btn = section.taboption(tabName, form.Button, `save_content_${config.name}`, 'Save Config');
  btn.inputstyle = 'positive';
  btn.onclick = async () => {
    const elVal = getInputValueByKey(key);
    if (!elVal) return notify('error', 'Config is empty');
    if (!isValidConfig(elVal)) return notify('error', 'Invalid Config');
    await saveFile(`/etc/sing-box/${config.name}`, elVal, 'Config saved');
    if (config.name === 'config.json') {
      await fs.exec('/etc/init.d/sing-box', ['reload']);
      notify('info', 'Config reloaded');
      setTimeout(() => location.reload(), 1000);
    } else {
      notify('info', 'Config saved');
      setTimeout(() => location.reload(), 1500);
    }
  };
}

function createSetMainButton(section, tabName, config) {
    if (config.name === 'config.json') return;
    const btn = section.taboption(tabName, form.Button, `set_main_${config.name}`, 'Set as Main');
    btn.inputstyle = 'apply';
    btn.onclick = async () => {
    try {
      const newContent = await loadFile(`/etc/sing-box/${config.name}`);
      const oldContent = await loadFile('/etc/sing-box/config.json');
      const newUrl = await loadFile(`/etc/sing-box/url_${config.name}`);
      const oldUrl = await loadFile('/etc/sing-box/url_config.json');

      await saveFile('/etc/sing-box/config.json', newContent);
      await saveFile(`/etc/sing-box/${config.name}`, oldContent);
      await saveFile('/etc/sing-box/url_config.json', newUrl);
      await saveFile(`/etc/sing-box/url_${config.name}`, oldUrl);

      await fs.exec('/etc/init.d/sing-box', ['reload']);
      notify('info', `${config.label} is now main`);
      setTimeout(() => location.reload(), 500);
    } catch (e) {
      notify('error', `Failed to set ${config.label} as main: ${e.message}`);
    }
  };
}

function configContent(section, tabName, config){
    createConfigEditor(section, tabName, config);
    createSaveContentButton(section, tabName, config);
}

function createConfigEditor(section, tabName, config) {
    const key = `content_${config.name}`;
    const txt = section.taboption(tabName, form.TextValue, key, config.label);
    txt.rows = 25;
    txt.wrap = 'off';
    txt.cfgvalue = () => loadFile(`/etc/sing-box/${config.name}`);
}

function SubscribeURL(section, tabName, config){
    createSubscribeEditor(section, tabName, config);
    createSaveUrlButton(section, tabName, config);
    createUpdateConfigButton(section, tabName, config);
}

function createSubscribeEditor(section, tabName, config){
    const urlKey = `subscribe_url_${config.name}`;
    const urlInput = section.taboption(tabName, form.Value, urlKey, 'Subscribe URL');
    urlInput.datatype = 'url';
    urlInput.placeholder = 'https://domain.com/subscribe';
    urlInput.rmempty = false;
    urlInput.cfgvalue = () => loadFile(`/etc/sing-box/url_${config.name}`);
}

async function getAutoUpdaterStatus() {
  try {
    const result = await fs.exec('/usr/bin/singb/singb-installer-autoupdater', ['status']);
    return result.stdout.trim();
  } catch {
    return 'stopped';
  }
}

function createAutoUpdaterSection(section) {
  section.tab('autoupdater', 'Auto-Updater');

  // Interval Input
  const intervalInput = section.taboption('autoupdater', form.Value, 'update_interval', 'Update Interval (seconds)');
  intervalInput.datatype = 'uinteger';
  intervalInput.placeholder = '3600';

  // Dynamic Buttons
  getAutoUpdaterStatus().then((status) => {
    const isRunning = status === 'running';

    if (!isRunning) {
      const installBtn = section.taboption('autoupdater', form.Button, 'install_autoupdater', 'Install Auto-Updater');
      installBtn.inputstyle = 'positive';
      installBtn.onclick = async () => {
        const interval = getInputValueByKey('update_interval');
        try {
          await fs.exec('/usr/bin/singb/singb-installer-autoupdater', ['install_autoupdater', interval || '3600']);
          notify('info', `Auto-Updater installed with interval ${interval || 3600} seconds`);
          setTimeout(() => location.reload(), 1000);
        } catch (e) {
          notify('error', `Install failed: ${e.message}`);
        }
      };
    } else {
      const uninstallBtn = section.taboption('autoupdater', form.Button, 'uninstall_autoupdater', 'Uninstall Auto-Updater');
      uninstallBtn.inputstyle = 'remove';
      uninstallBtn.onclick = async () => {
        try {
          await fs.exec('/usr/bin/singb/singb-installer-autoupdater', ['uninstall_autoupdater']);
          notify('info', 'Auto-Updater uninstalled');
          setTimeout(() => location.reload(), 1000);
        } catch (e) {
          notify('error', `Uninstall failed: ${e.message}`);
        }
      };
    }

    // Status Display
    const statusDisp = section.taboption('autoupdater', form.DummyValue, 'status', 'Updater Status');
    statusDisp.rawhtml = true;
    statusDisp.cfgvalue = () => {
      const colors = { running: 'green', stopped: 'red' };
      const txt = isRunning ? 'Running' : 'Stopped';
      const clr = colors[status] || 'orange';
      return `<span style="color: ${clr}; font-weight: bold;">${txt}</span>`;
    };
  });
}

// Main view
return view.extend({
  handleSave: null,
  handleSaveApply: null,
  handleReset: null,

  async render() {
    const m = new form.Map('singb', 'Singb Configuration');
    const s = m.section(form.TypedSection, 'main', 'Control Panel');
    s.anonymous = true;
    s.tab('service', 'Service Management');
    s.tab('config', 'Edit Config');

    const status = await getStatus();

    // Service status display
    const statusDisp = s.taboption('service', form.DummyValue, 'service_status', 'Service Status');
    statusDisp.rawhtml = true;
    statusDisp.cfgvalue = () => {
      const colors = { running: 'green', inactive: 'orange', error: 'red' };
      const txt = (status === 'running') ? 'Running'
                 : (status === 'inactive') ? 'Inactive'
                 : (status === 'error') ? 'Error fetching status'
                 : status;
      const clr = colors[status] || 'orange';
      return `<span style="color: ${clr}; font-weight: bold;">${txt}</span>`;
    };

    // Service action buttons
    ['start','stop','restart','reload'].forEach(a => createServiceButton(s, a, status));

    createAutoUpdaterSection(s);

    // Config Tabs
    const configs = [
      { name: 'config.json', label: 'Main Config' },
      { name: 'config2.json', label: 'Backup Config #1' },
      { name: 'config3.json', label: 'Backup Config #2' }
    ];

    configs.forEach(config => {
      const tab = (config.name === 'config.json') ? 'main_config' : `config_${config.name}`;
      s.tab(tab, config.label);

      SubscribeURL(s, tab, config);
      configContent(s, tab, config);
      createSetMainButton(s, tab, config);
    });

    return m.render();
  }
});
