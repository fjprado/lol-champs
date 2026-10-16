'use strict';

// Data Dragon endpoints
const DDRAGON = 'https://ddragon.leagueoflegends.com';
const LOCALE = 'en_US';

const url = {
    versions: () => `${DDRAGON}/api/versions.json`,
    champions: () => `${DDRAGON}/cdn/${state.version}/data/${LOCALE}/champion.json`,
    champion: (id) => `${DDRAGON}/cdn/${state.version}/data/${LOCALE}/champion/${id}.json`,
    icon: (id) => `${DDRAGON}/cdn/${state.version}/img/champion/${id}.png`,
    splash: (id, num) => `${DDRAGON}/cdn/img/champion/splash/${id}_${num}.jpg`,
    loading: (id, num) => `${DDRAGON}/cdn/img/champion/loading/${id}_${num}.jpg`,
    spell: (file) => `${DDRAGON}/cdn/${state.version}/img/spell/${file}`,
    passive: (file) => `${DDRAGON}/cdn/${state.version}/img/passive/${file}`,
    classIcon: (tag) => `./favicons/class-${tag.toLowerCase()}.png`,
};

const CLASSES = ['Assassin', 'Fighter', 'Mage', 'Marksman', 'Support', 'Tank'];
const ABILITY_KEYS = ['Q', 'W', 'E', 'R'];
const TABS = ['lore', 'abilities', 'stats'];

// Elements

const $ = (selector, root = document) => root.querySelector(selector);

const el = {
    stage: $('.stage'),
    backdrop: $('.backdrop__image'),

    /* Search */
    form: $('.search'),
    input: $('.search__input'),
    results: $('.search__results'),

    /* Top actions */
    btnRandom: $('.btn-random'),
    btnBrowse: $('.btn-browse'),

    /* Showcase */
    frame: $('.frame'),
    splash: $('.splash'),
    skinPrev: $('.skin-prev'),
    skinNext: $('.skin-next'),
    skinName: $('.skin-name'),
    skinCount: $('.skin-count'),
    skins: $('.skins'),

    /* Details */
    details: $('.details'),
    name: $('.champion-name'),
    title: $('.champion-title'),
    roles: $('.champion-roles'),
    tabs: [...document.querySelectorAll('.tab')],
    panels: TABS.map(tab => $(`#panel-${tab}`)),
    lore: $('.lore'),
    tips: $('.tips'),
    abilities: $('.abilities'),
    abilityKey: $('.ability__key'),
    abilityName: $('.ability__name'),
    abilityMeta: $('.ability__meta'),
    abilityDesc: $('.ability__desc'),
    ratings: $('.ratings'),
    baseStats: $('.base-stats'),

    /* Cycler */
    champPrev: $('.champ-prev'),
    champNext: $('.champ-next'),
    counter: $('.cycler__counter'),

    /* Browser */
    browser: $('.browser'),
    browserClose: $('.browser__close'),
    browserSearch: $('.browser__search'),
    browserRoles: $('.roles'),
    browserGrid: $('.browser__grid'),
    browserEmpty: $('.browser__empty'),

    toast: $('.toast'),
    patch: $('.patch'),
};

// State

const state = {
    version: null,
    champions: [],          // summaries sorted by name
    byId: new Map(),
    details: new Map(),     // champion id -> full data (cache)
    current: null,          // current champion detail
    skins: [],
    skinIndex: 0,
    abilities: [],
    abilityIndex: 0,
    tabIndex: 0,
    loadToken: 0,
    skinToken: 0,
    search: { matches: [], active: -1 },
    browserRole: null,
};

// Helpers

const fetchJSON = async (address) => {
    const response = await fetch(address);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
};

const normalize = (text) => text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '');

// Riot descriptions contain markup (<br>, <magicDamage>, ...). Parse inertly and keep the text.
const toPlainText = (html = '') => {
    const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, '\n'), 'text/html');
    return doc.body.textContent.replace(/\n{3,}/g, '\n\n').trim();
};

const formatNumber = (value) => Number(value.toFixed(3)).toString();

const create = (tag, props = {}, children = []) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
};

const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image failed: ${src}`));
    img.src = src;
});

const wrap = (index, length) => (index + length) % length;

let toastTimer;
const toast = (message) => {
    el.toast.textContent = message;
    el.toast.hidden = false;
    el.toast.style.animation = 'none';
    void el.toast.offsetWidth;
    el.toast.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 3500);
};

// Data

const fetchChampionList = async () => {
    const versions = await fetchJSON(url.versions());
    state.version = versions[0];

    const { data } = await fetchJSON(url.champions());
    state.champions = Object.values(data).sort((a, b) => a.name.localeCompare(b.name));
    state.champions.forEach(champ => state.byId.set(champ.id, champ));
};

const fetchChampion = async (id) => {
    if (!state.details.has(id)) {
        const { data } = await fetchJSON(url.champion(id));
        state.details.set(id, data[id]);
    }
    return state.details.get(id);
};

const findChampions = (query, limit = 8) => {
    const q = normalize(query);
    if (!q) return [];

    const rank = (champ) => {
        const name = normalize(champ.name);
        const id = normalize(champ.id);
        if (name === q || id === q) return 0;
        if (name.startsWith(q) || id.startsWith(q)) return 1;
        if (champ.name.split(/[\s'&.]+/).some(word => normalize(word).startsWith(q))) return 2;
        if (name.includes(q)) return 3;
        if (normalize(champ.title).includes(q)) return 4;
        return Infinity;
    };

    return state.champions
        .map(champ => ({ champ, score: rank(champ) }))
        .filter(x => x.score !== Infinity)
        .sort((a, b) => a.score - b.score || a.champ.name.localeCompare(b.champ.name))
        .slice(0, limit)
        .map(x => x.champ);
};

// Navigation (the URL hash is the source of truth, so links are shareable)

const navigate = (id) => {
    if (!id) return;
    if (decodeURIComponent(location.hash.slice(1)) === id) loadChampion(id);
    else location.hash = id;
};

const championFromHash = () => {
    const wanted = decodeURIComponent(location.hash.slice(1));
    if (!wanted) return null;
    return state.byId.get(wanted) ?? findChampions(wanted, 1)[0] ?? null;
};

const randomChampion = () => {
    const pool = state.champions.filter(champ => champ.id !== state.current?.id);
    return pool[Math.floor(Math.random() * pool.length)];
};

const neighbour = (step) => {
    const index = state.champions.findIndex(champ => champ.id === state.current?.id);
    return state.champions[wrap(index + step, state.champions.length)];
};

// Render champion

const loadChampion = async (id) => {
    const token = ++state.loadToken;
    el.stage.setAttribute('aria-busy', 'true');
    el.frame.classList.add('is-loading');

    try {
        const data = await fetchChampion(id);
        if (token !== state.loadToken) return;

        state.current = data;
        document.title = `${data.name} · LoL Champs`;

        renderIdentity(data);
        renderLore(data);
        renderAbilities(data);
        renderStats(data);
        renderSkins(data);
        renderCycler();
        replayEntrance();

        await showSkin(0);
    } catch (error) {
        if (token !== state.loadToken) return;
        console.error(error);
        el.frame.classList.remove('is-loading');
        toast(`Couldn't summon ${state.byId.get(id)?.name ?? id}. Please try again.`);
    } finally {
        if (token === state.loadToken) el.stage.setAttribute('aria-busy', 'false');
    }
};

const replayEntrance = () => {
    el.details.classList.remove('is-entering');
    void el.details.offsetWidth;
    el.details.classList.add('is-entering');
};

const renderIdentity = (data) => {
    el.name.textContent = data.name;
    el.title.textContent = data.title;
    el.roles.replaceChildren(...data.tags.map(tag => create('li', { className: 'role-chip' }, [
        create('img', { src: url.classIcon(tag), alt: '', width: 22, height: 22 }),
        tag,
    ])));
};

const renderLore = (data) => {
    el.lore.textContent = toPlainText(data.lore || data.blurb);

    const tipGroups = [
        [`Playing as ${data.name}`, data.allytips],
        [`Playing against ${data.name}`, data.enemytips],
    ].filter(([, tips]) => tips?.length);

    el.tips.replaceChildren(...tipGroups.map(([label, tips]) => create('details', {}, [
        create('summary', { textContent: label }),
        create('ul', {}, tips.map(tip => create('li', { textContent: toPlainText(tip) }))),
    ])));
};

// Abilities

const renderAbilities = (data) => {
    state.abilities = [
        { key: 'Passive', short: 'P', name: data.passive.name, description: data.passive.description, icon: url.passive(data.passive.image.full) },
        ...data.spells.map((spell, i) => ({
            key: ABILITY_KEYS[i],
            short: ABILITY_KEYS[i],
            name: spell.name,
            description: spell.description,
            icon: url.spell(spell.image.full),
            meta: abilityMeta(spell, data.partype),
        })),
    ];

    el.abilities.replaceChildren(...state.abilities.map((ability, i) => create('button', {
        type: 'button',
        className: 'ability-btn',
        title: `${ability.key}: ${ability.name}`,
        onclick: () => showAbility(i),
    }, [
        create('img', { src: ability.icon, alt: `${ability.key}: ${ability.name}`, width: 58, height: 58 }),
        create('span', { className: 'ability-btn__key', textContent: ability.short, ariaHidden: 'true' }),
    ])));

    el.abilities.querySelectorAll('.ability-btn').forEach(btn => btn.setAttribute('role', 'tab'));
    showAbility(0);
};

const abilityMeta = (spell, partype) => {
    const meta = [];

    if (spell.cooldownBurn && spell.cooldownBurn !== '0') {
        meta.push(['Cooldown', `${spell.cooldownBurn}s`]);
    }

    const cost = (spell.resource || '')
        .replace(/\{\{\s*cost\s*\}\}/g, spell.costBurn)
        .replace(/\{\{\s*abilityresourcename\s*\}\}/g, partype);
    if (cost && !cost.includes('{{') && spell.costBurn !== '0' && !/no cost/i.test(cost)) {
        meta.push(['Cost', cost]);
    }

    const range = Number(spell.rangeBurn?.split('/')[0]);
    if (range >= 25000) meta.push(['Range', 'Global']);
    else if (range > 0) meta.push(['Range', spell.rangeBurn]);

    return meta;
};

const showAbility = (index) => {
    state.abilityIndex = index;
    const ability = state.abilities[index];

    el.abilities.querySelectorAll('.ability-btn').forEach((btn, i) => {
        btn.setAttribute('aria-selected', String(i === index));
    });

    el.abilityKey.textContent = ability.key;
    el.abilityName.textContent = ability.name;
    el.abilityDesc.textContent = toPlainText(ability.description);
    el.abilityMeta.replaceChildren(...(ability.meta ?? []).map(([label, value]) => create('div', {}, [
        create('dt', { textContent: label }),
        create('dd', { textContent: value }),
    ])));

    // Restart the fade so each ability change feels responsive
    const box = el.abilityName.closest('.ability');
    box.style.animation = 'none';
    void box.offsetWidth;
    box.style.animation = '';
};

// Stats

const renderStats = (data) => {
    const ratings = [
        ['Attack', data.info.attack, 'var(--attack)'],
        ['Defense', data.info.defense, 'var(--defense)'],
        ['Magic', data.info.magic, 'var(--magic)'],
        ['Difficulty', data.info.difficulty, 'var(--difficulty)'],
    ];

    el.ratings.replaceChildren(...ratings.map(([label, value, color]) => {
        const fill = create('span', { className: 'rating__fill' });
        fill.style.width = `${value * 10}%`;
        fill.style.background = color;
        const bar = create('div', { className: 'rating__bar' }, [fill]);
        bar.setAttribute('role', 'meter');
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '10');
        bar.setAttribute('aria-valuenow', String(value));
        bar.setAttribute('aria-label', label);

        return create('div', { className: 'rating' }, [
            create('span', { className: 'rating__label', textContent: label }),
            bar,
            create('span', { className: 'rating__value', textContent: value }),
        ]);
    }));

    const s = data.stats;
    const usesResource = s.mp > 0 && data.partype && data.partype !== 'None';
    const stats = [
        ['Health', s.hp, s.hpperlevel],
        ['Health regen', s.hpregen, s.hpregenperlevel],
        usesResource && [data.partype, s.mp, s.mpperlevel],
        ['Attack damage', s.attackdamage, s.attackdamageperlevel],
        ['Attack speed', s.attackspeed, s.attackspeedperlevel, '%'],
        ['Armor', s.armor, s.armorperlevel],
        ['Magic resist', s.spellblock, s.spellblockperlevel],
        ['Move speed', s.movespeed],
        ['Attack range', s.attackrange],
    ].filter(Boolean);

    el.baseStats.replaceChildren(...stats.map(([label, base, perLevel, unit = '']) => {
        const value = create('dd', { textContent: formatNumber(base) });
        if (perLevel) value.append(' ', create('small', { textContent: `+${formatNumber(perLevel)}${unit}` }));
        return create('div', {}, [create('dt', { textContent: label }), value]);
    }));
};

// Tabs

const showTab = (index, { focus = false } = {}) => {
    state.tabIndex = index;
    el.tabs.forEach((tab, i) => {
        const selected = i === index;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        el.panels[i].hidden = !selected;
    });
    if (focus) el.tabs[index].focus();
};

// Skins

const renderSkins = (data) => {
    // Chromas carry a parentSkin, keep only full skins
    state.skins = data.skins.filter(skin => !skin.parentSkin);
    state.skinIndex = 0;

    el.skins.replaceChildren(...state.skins.map((skin, i) => {
        const label = skin.num === 0 ? `${data.name} (Default)` : skin.name;
        const btn = create('button', {
            type: 'button',
            className: 'skins__item',
            title: label,
            onclick: () => showSkin(i),
        }, [create('img', { src: url.loading(data.id, skin.num), alt: label, loading: 'lazy', decoding: 'async' })]);
        btn.setAttribute('role', 'option');
        return btn;
    }));

    const single = state.skins.length < 2;
    el.skinPrev.disabled = single;
    el.skinNext.disabled = single;
};

const showSkin = async (index) => {
    const champ = state.current;
    if (!champ || !state.skins.length) return;

    const token = ++state.skinToken;
    state.skinIndex = wrap(index, state.skins.length);
    const skin = state.skins[state.skinIndex];
    const label = skin.num === 0 ? champ.name : skin.name;

    el.skinName.textContent = label;
    el.skinCount.textContent = `${state.skinIndex + 1} / ${state.skins.length}`;
    [...el.skins.children].forEach((item, i) => {
        const selected = i === state.skinIndex;
        item.setAttribute('aria-selected', String(selected));
        // Scroll only the strip horizontally; scrollIntoView would also jump the page
        if (selected) el.skins.scrollTo({ left: item.offsetLeft - (el.skins.clientWidth - item.offsetWidth) / 2 });
    });

    const src = url.splash(champ.id, skin.num);
    el.frame.classList.add('is-loading');

    try {
        await loadImage(src);
        if (token !== state.skinToken) return;
        el.splash.src = src;
        el.splash.alt = `${label} splash art`;
        setBackdrop(src);
        preloadNeighbourSkins();
    } catch {
        if (token !== state.skinToken) return;
        toast(`The splash art for ${label} isn't available yet.`);
    } finally {
        if (token === state.skinToken) el.frame.classList.remove('is-loading');
    }
};

const preloadNeighbourSkins = () => {
    const { current, skins, skinIndex } = state;
    if (skins.length < 2) return;
    [1, -1].forEach(step => {
        const skin = skins[wrap(skinIndex + step, skins.length)];
        new Image().src = url.splash(current.id, skin.num);
    });
};

const setBackdrop = (src) => {
    el.backdrop.classList.remove('is-ready');
    requestAnimationFrame(() => {
        el.backdrop.style.backgroundImage = `url("${src}")`;
        el.backdrop.classList.add('is-ready');
    });
};

// Prev / next champion bar

const renderCycler = () => {
    const index = state.champions.findIndex(champ => champ.id === state.current.id);
    el.counter.textContent = `${index + 1} / ${state.champions.length}`;

    [[el.champPrev, neighbour(-1)], [el.champNext, neighbour(1)]].forEach(([btn, champ]) => {
        $('.cycler__name', btn).textContent = champ.name;
        $('.cycler__icon', btn).src = url.icon(champ.id);
        btn.setAttribute('aria-label', `${btn === el.champPrev ? 'Previous' : 'Next'} champion: ${champ.name}`);
    });
};

// Search combobox

const renderSearchResults = () => {
    const { matches, active } = state.search;
    const query = el.input.value.trim();

    if (!query) return closeSearch();

    if (!matches.length) {
        el.results.replaceChildren(create('li', { className: 'search__none', textContent: 'No champion found' }));
    } else {
        el.results.replaceChildren(...matches.map((champ, i) => {
            const option = create('li', { className: 'search__option', id: `search-option-${i}` }, [
                create('img', { src: url.icon(champ.id), alt: '', width: 34, height: 34, loading: 'lazy' }),
                create('div', {}, [
                    create('strong', { textContent: champ.name }),
                    create('span', { textContent: champ.title }),
                ]),
            ]);
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', String(i === active));
            option.addEventListener('mousedown', (event) => event.preventDefault());
            option.addEventListener('click', () => selectSearchResult(champ));
            return option;
        }));
    }

    el.results.hidden = false;
    el.input.setAttribute('aria-expanded', 'true');
    if (active >= 0) {
        el.input.setAttribute('aria-activedescendant', `search-option-${active}`);
        el.results.children[active]?.scrollIntoView({ block: 'nearest' });
    } else {
        el.input.removeAttribute('aria-activedescendant');
    }
};

const closeSearch = () => {
    el.results.hidden = true;
    el.input.setAttribute('aria-expanded', 'false');
    el.input.removeAttribute('aria-activedescendant');
};

const selectSearchResult = (champ) => {
    el.input.value = '';
    closeSearch();
    el.input.blur();
    navigate(champ.id);
};

el.input.addEventListener('input', () => {
    state.search.matches = findChampions(el.input.value);
    state.search.active = state.search.matches.length ? 0 : -1;
    renderSearchResults();
});

el.input.addEventListener('focus', () => {
    if (el.input.value.trim()) renderSearchResults();
});

el.input.addEventListener('blur', closeSearch);

el.input.addEventListener('keydown', (event) => {
    const { matches } = state.search;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!matches.length) return;
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        state.search.active = wrap(state.search.active + step, matches.length);
        renderSearchResults();
    } else if (event.key === 'Escape') {
        if (!el.results.hidden) closeSearch();
        else el.input.blur();
    }
});

el.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const { matches, active } = state.search;
    const champ = matches[active] ?? findChampions(el.input.value, 1)[0];
    if (champ) selectSearchResult(champ);
    else if (el.input.value.trim()) toast(`No champion answers to "${el.input.value.trim()}".`);
});

// Champion browser dialog

const buildBrowser = () => {
    el.browserRoles.replaceChildren(...CLASSES.map(tag => {
        const btn = create('button', {
            type: 'button',
            className: 'role-filter',
            title: tag,
            onclick: () => {
                state.browserRole = state.browserRole === tag ? null : tag;
                filterBrowser();
            },
        }, [create('img', { src: url.classIcon(tag), alt: tag, width: 24, height: 24 })]);
        btn.dataset.role = tag;
        btn.setAttribute('aria-pressed', 'false');
        return btn;
    }));

    el.browserGrid.replaceChildren(...state.champions.map(champ => {
        const item = create('li', {}, [create('button', {
            type: 'button',
            className: 'browser__card',
            title: `${champ.name}, ${champ.title}`,
            onclick: () => {
                el.browser.close();
                navigate(champ.id);
            },
        }, [
            create('img', { src: url.icon(champ.id), alt: '', loading: 'lazy', decoding: 'async', width: 120, height: 120 }),
            champ.name,
        ])]);
        item.dataset.id = champ.id;
        return item;
    }));
};

const filterBrowser = () => {
    const query = normalize(el.browserSearch.value);
    let visible = 0;

    [...el.browserGrid.children].forEach(item => {
        const champ = state.byId.get(item.dataset.id);
        const show = (!query || normalize(champ.name).includes(query))
            && (!state.browserRole || champ.tags.includes(state.browserRole));
        item.hidden = !show;
        if (show) visible++;
    });

    el.browserRoles.querySelectorAll('.role-filter').forEach(btn => {
        btn.setAttribute('aria-pressed', String(btn.dataset.role === state.browserRole));
    });
    el.browserEmpty.hidden = visible > 0;
};

const openBrowser = () => {
    if (!state.champions.length) return;
    [...el.browserGrid.children].forEach(item => {
        $('.browser__card', item).setAttribute('aria-current', String(item.dataset.id === state.current?.id));
    });
    el.browser.showModal();
    el.browserSearch.focus();
    el.browserGrid.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'center' });
};

el.btnBrowse.addEventListener('click', openBrowser);
el.browserClose.addEventListener('click', () => el.browser.close());
el.browserSearch.addEventListener('input', filterBrowser);
el.browser.addEventListener('click', (event) => {
    // Clicking the backdrop (the dialog itself, outside the inner box) closes it
    if (event.target === el.browser) el.browser.close();
});
el.browserSearch.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const first = [...el.browserGrid.children].find(item => !item.hidden);
    if (first) $('.browser__card', first).click();
});

// Buttons

el.btnRandom.addEventListener('click', () => navigate(randomChampion()?.id));
el.champPrev.addEventListener('click', () => state.current && navigate(neighbour(-1).id));
el.champNext.addEventListener('click', () => state.current && navigate(neighbour(1).id));
el.skinPrev.addEventListener('click', () => showSkin(state.skinIndex - 1));
el.skinNext.addEventListener('click', () => showSkin(state.skinIndex + 1));

el.tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => showTab(i));
    tab.addEventListener('keydown', (event) => {
        const moves = { ArrowRight: 1, ArrowLeft: -1 };
        if (event.key in moves) {
            event.preventDefault();
            showTab(wrap(i + moves[event.key], TABS.length), { focus: true });
        } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            showTab(event.key === 'Home' ? 0 : TABS.length - 1, { focus: true });
        }
    });
});

// Keyboard shortcuts

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || el.browser.open) return;
    const target = event.target;
    const typing = target.closest('input, textarea, select, [contenteditable="true"]');
    if (typing) return;

    if (event.key === '/') {
        event.preventDefault();
        el.input.focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        // Leave arrow keys alone where they already mean something (tabs)
        if (target.closest('[role="tab"]')) return;
        const step = event.key === 'ArrowRight' ? 1 : -1;
        event.preventDefault();
        if (event.shiftKey) (step > 0 ? el.champNext : el.champPrev).click();
        else showSkin(state.skinIndex + step);
    }
});

// Swipe on the splash to change skins (touch devices)
let touchStartX = null;
el.frame.addEventListener('touchstart', (event) => { touchStartX = event.touches[0].clientX; }, { passive: true });
el.frame.addEventListener('touchend', (event) => {
    if (touchStartX === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(delta) > 50) showSkin(state.skinIndex + (delta < 0 ? 1 : -1));
}, { passive: true });

window.addEventListener('hashchange', () => {
    const champ = championFromHash();
    if (champ && champ.id !== state.current?.id) loadChampion(champ.id);
});

// Boot

const init = async () => {
    showTab(0);
    try {
        await fetchChampionList();
    } catch (error) {
        console.error(error);
        el.frame.classList.remove('is-loading');
        el.name.textContent = 'Offline';
        el.lore.textContent = "Couldn't reach Data Dragon. Check your connection and reload the page.";
        toast("Couldn't load champions from Data Dragon.");
        return;
    }

    el.patch.textContent = ` (patch ${state.version})`;
    buildBrowser();

    const fromHash = championFromHash();
    const champ = fromHash ?? randomChampion();
    if (fromHash && fromHash.id !== decodeURIComponent(location.hash.slice(1))) {
        history.replaceState(null, '', `#${fromHash.id}`);
    }
    if (!location.hash) history.replaceState(null, '', `#${champ.id}`);
    loadChampion(champ.id);
};

el.frame.classList.add('is-loading');
init();
