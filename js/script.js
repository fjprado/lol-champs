// Elements

/* Champion Box */
const championName = document.querySelector('.champion__name');
const championTitle = document.querySelector('.champion__title');
const championImage = document.querySelector('.champion__image');

/* Search Box */
const form = document.querySelector('.form');
const input = document.querySelector('.input__search');

/* Buttons Box */
const btnChampPrev = document.querySelector('.function.btn-prev');
const btnChampNext = document.querySelector('.function.btn-next');
const btnChampRandom = document.querySelector('.function.btn-random');
const btnSkinPrev = document.querySelector('.skin.btn-prev');
const btnSkinNext = document.querySelector('.skin.btn-next');
const btnInfoPrev = document.querySelector('.btn-info-prev');
const btnInfoNext = document.querySelector('.btn-info-next');

/* Sections Box */
const infoLore = document.querySelector('#info__lore');
const infoStats = document.querySelector('#info__stats');
const infoSpells = document.querySelector('#info__spells');

/* Details Box */
const championLore = document.querySelector('.content__info__lore');
const championClassTitle = document.querySelector('.classes__title');
const championClass = document.querySelector('.champion__classes');
const championPassiveTitle = document.querySelector('.passive__title');
const championPassive = document.querySelector('.champion__passive');
const championSpellsTitle = document.querySelector('.spells__title');
const championSpells = document.querySelector('.champion__spells');

/* Global Variables */
let champions = [];
let currentChampion;
let currentChampionDetails;
let skins = [];
let currentSkin;
let statsChart;
let infoIndex = 0;

// Get current version
const fetchVersions = async () => {    
    const APIVersions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    currentVersion = (await APIVersions.json())[0];
}

// Get current list of champions
const fetchChampions = async () => { 
    await fetchVersions();  
    const APIChampions = await fetch(`http://ddragon.leagueoflegends.com/cdn/${currentVersion}/data/en_US/champion.json`)
    const data = (await APIChampions.json()).data;
    champions = Object.keys(data);
}

// Get champion details
const fetchChampion = async (champion) => {
    const APIChampion = await fetch(`http://ddragon.leagueoflegends.com/cdn/${currentVersion}/data/en_US/champion/${champion}.json`) 
    const data = (await APIChampion.json()).data; 
    return Object.values(data)[0];
}

// Render Champion
const renderChampion = async (champ) => {    
    await fetchChampions();
    currentChampion = champ ? 
        champions.find(y => y.toLowerCase().startsWith(champ.toLowerCase())) : 
        champions[0];
        
    if(currentChampion){
        const data = await fetchChampion(currentChampion);
        if(data){
            currentChampionDetails = {
                classes: data.tags,
                stats: data.info,
                passive: { id: data.passive.image.full, name: data.passive.name},                
                spells: data.spells.map(y => {
                    return {
                        id: y.id,
                        name: y.name
                    }
                })
            };
            skins = data.skins.map(x => {
                return { id: x.num, name: x.name}
            });
            infoIndex = 0;
            championTitle.innerHTML = data.title;
            championLore.innerHTML = data.lore;
            changeInfo(infoIndex);
            changeSkin(skins[0]);        
            generateStats();        
            generateSpells();        
            input.value = '';
        }else {
            alert("Data Not Found!"); 
        }
    } else {
        alert("Champion Not Found!");
    }     
}

// Change Champion and Skin Image
const changeSkin = async (skin) => {   
    currentSkin = skin
    championImage.src = `http://ddragon.leagueoflegends.com/cdn/img/champion/splash/${currentChampion}_${currentSkin.id}.jpg`
    championName.innerHTML = currentSkin.id == 0 ? currentChampion : currentSkin.name;
}

/* Buttons Box */
form.addEventListener('submit', (event) => {
    event.preventDefault();
    renderChampion(input.value);
});

btnChampPrev.addEventListener('click', () => {
    let champIndex = champions.findIndex(x => x == currentChampion);
    if(champIndex == 0)            
        renderChampion(champions[champions.length - 1]);
    else
        renderChampion(champions[--champIndex]);
});

btnChampNext.addEventListener('click', () => {
    let champIndex = champions.findIndex(x => x == currentChampion);
    if(champIndex == champions.length - 1)            
        renderChampion(champions[0]);
    else{
        renderChampion(champions[++champIndex]);
    }        
});

btnSkinPrev.addEventListener('click', () => {
    if(currentChampion){
        let skinIndex = skins.findIndex(x => x == currentSkin);
        if(skinIndex == 0)            
            changeSkin(skins[skins.length - 1]);
        else
            changeSkin(skins[--skinIndex]);
    }    
});

btnSkinNext.addEventListener('click', () => {
    if(currentChampion){
        let skinIndex = skins.findIndex(x => x == currentSkin);
        if(skinIndex == skins.length - 1)            
            changeSkin(skins[0]);
        else
            changeSkin(skins[++skinIndex]); 
    }       
});

btnChampRandom.addEventListener('click', async () => {
    if(champions.length == 0){
        await fetchChampions();
    }

    let champRandomIndex = Math.floor(Math.random() * (champions.length)) + 1;
    renderChampion(champions[champRandomIndex]);    
});

btnInfoPrev.addEventListener('click', () => {
    infoIndex = infoIndex == 0 ? 2 : --infoIndex;
    changeInfo(infoIndex);   
})

btnInfoNext.addEventListener('click', () => {
    infoIndex = infoIndex == 2 ? 0 : ++infoIndex;
    changeInfo(infoIndex);
})

// Active and Inactive Sections
function changeInfo(infoIndex) {
    switch (infoIndex) {
        case 0:
            infoLore.style.display = "flex";
            infoStats.style.display = "none";
            infoSpells.style.display = "none";
            break;
        case 1:
            infoLore.style.display = "none";
            infoSpells.style.display = "none";
            infoStats.style.display = "flex";
            generateStats();
            break;
        case 2:
            infoLore.style.display = "none";
            infoStats.style.display = "none";
            infoSpells.style.display = "flex";
            generateSpells();
            break;
    }
}

const getChampionData = () => {   
    if(currentChampionDetails)
        return Object.values(currentChampionDetails.stats);
};

// Generate Champion Stats Chart
const generateStats = () => {
    championClassTitle.style.display = "block";
    championClass.innerHTML = '';
    currentChampionDetails.classes.forEach(x => {
        var elem = document.createElement("img");
        elem.className = "classes__icons";
        elem.src = `./favicons/class-${x.toLowerCase()}.png`;
        elem.style.width = "50px";
        elem.style.padding = "5px";
        championClass.appendChild(elem);
    });
    const data = getChampionData();
    
    if(statsChart)
        statsChart.destroy();

    statsChart = new Chart("championStats", {
        type: "polarArea",
        data: {
            labels: [
                'Attack',
                'Defense',
                'Magic',
                'Difficulty'
            ],
            datasets: [{
                label: '',
                data: data,
                backgroundColor: [
                'rgb(220,20,60)',
                'rgb(60,179,113)',
                'rgb(30,144,255)',
                'rgb(255, 255, 0)'
                ],
                borderColor: '#2e2e2e',
                borderWidth: 1,
                hoverBorderWidth: 3,
                hoverBorderColor: '#000'
            }]
        },
        options: { 
            title: {
                display: true,
                position: "left",
                text: "Champion Stats",
                fontSize: 16,
                fontColor: '#2e2e2e'
            },
            legend: {
                align: "center",
                position: "left",
                labels: {
                    usePointStyle: true,
                    fontSize:  12,
                    fontColor: '#2e2e2e'
                }
            },
            scale: {
                gridLines : {
                    color: '#2e2e2e',
                    lineWidth: 0.25,
                },
                ticks: {
                    display: false,
                    beginAtZero: true,
                    max: 10,
                    min: 0,
                    stepSize: 2                    
                },
                            
            },            
        }
    });
};

// Generate Champion Spells
const generateSpells = () => {
    championSpellsTitle.style.display = "block";
    championPassiveTitle.style.display = "block";
    championSpells.innerHTML = '';
    championPassive.innerHTML = '';

    currentChampionDetails.spells.forEach(x => {
        var elementSpell = document.createElement("div");
        elementSpell.className = "spell";
        var elemImg = document.createElement("img");
        elemImg.className = "spell__icons";
        elemImg.src = `https://ddragon.leagueoflegends.com/cdn/13.16.1/img/spell/${x.id}.png`;
        var elemName = document.createElement("p");
        elemName.className = "spell__name";
        elemName.innerHTML = x.name;
        elementSpell.appendChild(elemImg);
        elementSpell.appendChild(elemName); 
        championSpells.appendChild(elementSpell);
    });

    var elemPassiveImg = document.createElement("img");
    elemPassiveImg.className = "passive__icon";
    elemPassiveImg.src = `http://ddragon.leagueoflegends.com/cdn/13.16.1/img/passive/${currentChampionDetails.passive.id}`;
    var elemPassiveName = document.createElement("p");
    elemPassiveName.className = "passive__name";
    elemPassiveName.innerHTML = currentChampionDetails.passive.name;
    championPassive.appendChild(elemPassiveImg);
    championPassive.appendChild(elemPassiveName);
};
    
