
        // Import Firebase and ImageKit functions
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getFirestore, collection, doc, addDoc, getDoc, setDoc, deleteDoc, onSnapshot, query, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

        // --- CONFIGURATION ---
        const firebaseConfig = {
            apiKey: "AIzaSyC55F9Wj8b_XL4iKDzPZvcuEAp4eGATTqg",
            authDomain: "agency-e8801.firebaseapp.com",
            projectId: "agency-e8801",
            storageBucket: "agency-e8801.appspot.com",
            messagingSenderId: "472296401171",
            appId: "1:472296401171:web:20bc78c351f9e949dc12e6"
        };
        
        const imageKitConfig = {
            publicKey: "public_rJ83Er/Hs9uSD4BdDxH+wZ9n9m8=",
            urlEndpoint: "https://ik.imagekit.io/5r07rjszs",
            authenticationEndpoint: "http://localhost:3001/auth" 
        };

        // --- INITIALIZE SERVICES ---
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const auth = getAuth(app);
        const imagekit = new ImageKit(imageKitConfig);

        // --- APPLICATION STATE ---
        let currentView = 'world'; // 'world' or 'case'
        let currentCollection = 'characters';
        let currentDocId = null;
        let dataCache = {}; // Cache for all collection data
        const listeners = {}; // To hold our snapshot listeners
        
        const NAV_CONFIG = {
            world: [
                { id: 'characters', name: 'Characters', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>' },
                { id: 'locations', name: 'Locations', icon: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>' },
                { id: 'factions', name: 'Factions', icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>' },
                { id: 'items', name: 'Items', icon: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 1 0 1.4l-6.4 6.4c-.5.5-1.2.7-1.9.7H6v-3.3c0-.7.2-1.4.7-1.9l6.4-6.4a1 1 0 0 1 1.4 0Z"></path><path d="m21.5 2.5-2.3 2.3"></path>' },
                { id: 'districts', name: 'Districts', icon: '<path d="M8 20v-5.59L2.41 10 2 10.41V20h6zM14 20v-8l-6-6-6 6v8h12z"/><path d="M18 10.41V20h6V4.41L18,10.41z"/>' },
                { id: 'sleuth', name: 'Sleuth', icon: '<path d="M10.6.8a1 1 0 0 1 1.2 1.2l-1 4.5a1 1 0 0 1-1.2 1.2l-4.5 1a1 1 0 0 1-1.2-1.2l1-4.5a1 1 0 0 1 1.2-1.2l4.5-1zm7.8 7.8a1 1 0 0 1 1.2 1.2l-1 4.5a1 1 0 0 1-1.2 1.2l-4.5 1a1 1 0 0 1-1.2-1.2l1-4.5a1 1 0 0 1 1.2-1.2l4.5-1z"/><path d="M3.7 15.3a1 1 0 0 1 1.2 1.2l-1 4.5a1 1 0 0 1-1.2 1.2l-1.5-.3a1 1 0 0 1-.9-1.5l1-4.5a1 1 0 0 1 1.2-1.2l.2.1z"/>' }
            ],
            case: [
                { id: 'case_meta', name: 'Case Meta', icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line>' },
                { id: 'clues', name: 'Clues', icon: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line>' }
            ]
        };
        const COLLECTIONS_TO_CACHE = ['characters', 'locations', 'factions', 'items', 'districts', 'sleuth', 'case_meta', 'clues'];

        // --- DOM ELEMENTS ---
        const mainLayout = document.getElementById('main-layout');
        const mainContent = document.getElementById('main-content');
        const assetListContainer = document.getElementById('asset-list-container');
        const newAssetBtn = document.getElementById('new-asset-btn');
        const newAssetBtnText = document.getElementById('new-asset-btn-text');
        const topNavTabs = document.getElementById('top-nav-tabs');
        const leftNavBar = document.getElementById('left-nav-bar');
        const focusToggleBtn = document.getElementById('focus-toggle-btn');
        const modal = document.getElementById('confirmation-modal');
        const modalConfirmBtn = document.getElementById('modal-confirm-btn');
        const modalCancelBtn = document.getElementById('modal-cancel-btn');

        // --- INITIALIZATION ---
        document.addEventListener('DOMContentLoaded', () => {
            onAuthStateChanged(auth, user => {
                if (user) {
                    console.log("User is signed in:", user.uid);
                    initializeAndListenToAllCollections();
                } else {
                    console.log("User is signed out. Signing in anonymously...");
                    signInAnonymously(auth).catch(error => {
                        console.error("Anonymous sign-in failed:", error);
                        mainContent.innerHTML = `<div class="p-8 m-4 bg-red-900/30 border border-red-600 rounded-lg text-red-200">...</div>`;
                    });
                }
            });

            topNavTabs.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    switchTopView(e.target.dataset.view);
                }
            });
            
            leftNavBar.addEventListener('click', (e) => {
                const navBtn = e.target.closest('.nav-btn');
                if (navBtn) {
                    switchAssetType(navBtn.dataset.collection);
                }
            });

            newAssetBtn.addEventListener('click', handleNewAsset);
            focusToggleBtn.addEventListener('click', () => mainLayout.classList.toggle('focus-mode'));
        });

        function initializeAndListenToAllCollections() {
            const collectionsToInitialize = {
                sleuth: { name: 'Sleuth' },
                case_meta: { name: 'Case Meta' }
            };

            COLLECTIONS_TO_CACHE.forEach(collectionName => {
                dataCache[collectionName] = [];
                if (listeners[collectionName]) listeners[collectionName](); // Detach old listener

                const q = query(collection(db, collectionName));
                listeners[collectionName] = onSnapshot(q, (querySnapshot) => {
                    const assets = [];
                    querySnapshot.forEach((doc) => {
                        assets.push({ id: doc.id, ...doc.data() });
                    });
                    dataCache[collectionName] = assets.sort((a,b) => (a.name || a.fullName || a.district || '').localeCompare(b.name || b.fullName || b.district || ''));
                    
                    if (collectionName === currentCollection) {
                        renderAssetList();
                    }
                    console.log(`Cache updated for ${collectionName}:`, assets.length, 'items');

                    // Ensure singleton documents exist
                    if (collectionsToInitialize[collectionName] && assets.length === 0) {
                        console.log(`Initializing singleton document for ${collectionName}`);
                        addDoc(collection(db, collectionName), collectionsToInitialize[collectionName]);
                    }

                }, (error) => console.error(`Error listening to ${collectionName}:`, error));
            });

            switchTopView('world'); // Start with the world builder view
        }
        
        // --- VIEW SWITCHING LOGIC ---
        function switchTopView(view) {
            currentView = view;
            document.querySelectorAll('#top-nav-tabs .top-nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === view);
            });
            renderLeftNav();
            switchAssetType(NAV_CONFIG[view][0].id);
        }

        function renderLeftNav() {
            leftNavBar.innerHTML = '';
            NAV_CONFIG[currentView].forEach(item => {
                const btn = document.createElement('div');
                btn.className = 'group relative';
                btn.innerHTML = `
                    <button data-collection="${item.id}" aria-label="${item.name}" class="nav-btn p-3 rounded-lg hover:bg-gray-700/50 transition-colors w-full flex justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400 group-hover:text-white">${item.icon}</svg>
                    </button>
                    <div class="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">${item.name}</div>
                `;
                leftNavBar.appendChild(btn);
            });
        }

        function switchAssetType(collectionName) {
            currentCollection = collectionName;
            currentDocId = null;
            
            document.querySelectorAll('#left-nav-bar .nav-btn').forEach(btn => {
                const svg = btn.querySelector('svg');
                if (btn.dataset.collection === collectionName) {
                    btn.classList.add('bg-cyan-500/20', 'border', 'border-cyan-500/50');
                    svg.classList.add('text-cyan-400');
                } else {
                    btn.classList.remove('bg-cyan-500/20', 'border', 'border-cyan-500/50');
                    svg.classList.remove('text-cyan-400');
                }
            });

            const collectionConfig = NAV_CONFIG[currentView].find(c => c.id === collectionName);
            const isSingleton = collectionName === 'sleuth' || collectionName === 'case_meta';
            
            newAssetBtn.style.display = isSingleton ? 'none' : 'flex';
            if (!isSingleton) {
                const singularName = collectionConfig.name.endsWith('s') ? collectionConfig.name.slice(0, -1) : collectionConfig.name;
                newAssetBtnText.textContent = `New ${singularName}`;
            }

            mainContent.innerHTML = `<div class="h-full flex items-center justify-center"><div class="text-center text-gray-500"><p>Select an item from the left panel${isSingleton ? '' : ' or create a new one'}.</p></div></div>`;
            renderAssetList();
            
            if (isSingleton) {
                const data = dataCache[collectionName]?.[0];
                if (data) {
                    displayAssetForm(collectionName, data);
                }
            }
        }

        // --- RENDERING & FORM GENERATION ---
        function renderAssetList() {
            const assets = dataCache[currentCollection] || [];
            assetListContainer.innerHTML = '';
            
            const isSingleton = currentCollection === 'sleuth' || currentCollection === 'case_meta';
            if (isSingleton) return;

            assets.forEach(asset => {
                const assetName = asset.name || asset.fullName || asset.district || asset.clue_summary || 'Untitled';
                const itemEl = document.createElement('div');
                itemEl.className = 'asset-item relative group';
                itemEl.dataset.assetId = asset.id;
                itemEl.innerHTML = `
                    <a href="#" class="block p-3 rounded-md hover:bg-gray-700/50 transition-colors ${asset.id === currentDocId ? 'active' : ''}">
                        <h3 class="font-bold text-white truncate">${assetName}</h3>
                    </a>
                    <button class="delete-btn absolute top-1/2 right-3 -translate-y-1/2 p-1 rounded-full bg-red-600/80 text-white hover:bg-red-500" aria-label="Delete ${assetName}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                `;
                assetListContainer.appendChild(itemEl);

                itemEl.querySelector('a').addEventListener('click', (e) => {
                    e.preventDefault();
                    displayAssetForm(currentCollection, asset);
                });

                itemEl.querySelector('.delete-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    showConfirmationModal(asset.id, assetName);
                });
            });
        }

        function displayAssetForm(collectionName, assetData = {}) {
            currentDocId = assetData.id || null;
            document.querySelectorAll('.asset-item a').forEach(a => a.classList.remove('active'));
            if(currentDocId) {
                const itemEl = assetListContainer.querySelector(`[data-asset-id="${currentDocId}"] a`);
                if(itemEl) itemEl.classList.add('active');
            }

            mainContent.innerHTML = getFormHTML(collectionName, assetData);
            attachFormEventListeners(collectionName);
        }

        function getFormHTML(collectionName, data) {
            const formGenerators = {
                'characters': generateCharacterForm,
                'locations': generateLocationForm,
                'factions': generateFactionForm,
                'items': generateItemForm,
                'districts': generateDistrictForm,
                'sleuth': generateSleuthForm,
                'case_meta': generateCaseMetaForm,
                'clues': generateClueForm,
            };
            const generator = formGenerators[collectionName];
            return generator ? generator(data) : `<div class="p-6"><h2 class="text-2xl gold-text">Form for ${collectionName} not implemented yet.</h2></div>`;
        }
        
        // --- FORM IMPLEMENTATIONS ---
        
        function generateCharacterForm(data = {}) {
            const title = data.fullName || 'New Character';
            const factionOptions = generateOptions(dataCache.factions, data.faction, 'name');
            const districtOptions = generateOptions(dataCache.districts, data.district, 'district');
            const characterOptions = generateOptions(dataCache.characters, null, 'fullName');
            const itemOptions = generateOptions(dataCache.items, null, 'name');
            const wealthOptions = generateOptions([
                { id: '5', name: 'Old Money Rich' }, { id: '4', name: 'New Money Rich' }, { id: '3', name: 'Business Person' },
                { id: '2', name: 'Working Stiff' }, { id: '1', name: 'Poor' }, { id: '0', name: 'Transient' }
            ], data.wealthClass, 'name');
            const genderOptions = generateOptions([
                {id: 'Male', name: 'Male'}, {id: 'Female', name: 'Female'}, {id: 'Nonbinary', name: 'Nonbinary'},
                {id: 'Trans Man', name: 'Trans Man'}, {id: 'Trans Woman', name: 'Trans Woman'},
                {id: 'Unknown', name: 'Unknown'}, {id: 'Unspecified', name: 'Unspecified'}
            ], data.gender, 'name');

            return `
                ${generateDossierHeader(title, [
                    { id: 'identity', name: 'Identity' }, { id: 'psychology', name: 'Psychology' },
                    { id: 'social', name: 'Social' }, { id: 'narrative', name: 'Narrative' }
                ])}
                <div class="bg-[var(--form-bg)] rounded-lg shadow-2xl text-[var(--form-text)] relative dossier-panel rounded-tl-none">
                    <form id="asset-form" data-id="${data.id || ''}">
                        <div class="p-6">
                            <div id="identity-panel" class="dossier-tab-panel">
                                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div class="lg:col-span-1">${generateImageUploader(data.image, 'Character Portrait')}</div>
                                    <div class="lg:col-span-2 space-y-4">
                                        ${generateTextField('fullName', 'Full Name', data.fullName, "The character's full name")}
                                        ${generateTextField('alias', 'Alias', data.alias, "Any other names this character is known by")}
                                        <div class="grid grid-cols-2 gap-4">
                                            ${generateNumberField('age', 'Age', data.age, "The character's age")}
                                            ${generateSelectField('gender', 'Gender', genderOptions, data.gender, "The character's gender")}
                                        </div>
                                        ${generateTextField('employment', 'Employment', data.employment, "The character's occupation or role in the world")}
                                        ${generateTextareaField('biography', 'Biography', data.biography, "Who is this character? Their backstory...", 6)}
                                    </div>
                                </div>
                            </div>
                            <div id="psychology-panel" class="dossier-tab-panel hidden space-y-4">
                                ${generateAlignmentGrid(data.alignment)}
                                ${generateMultiStringField('personality', 'Personality', data.personality, "The character's core personality traits...")}
                                ${generateMultiStringField('values', 'Values', data.values, "Fundamental principles or beliefs...")}
                                ${generateMultiStringField('motivations', 'Motivations', data.motivations, "What drives this character...")}
                                ${generateMultiStringField('secrets', 'Secrets', data.secrets, "What secrets is this character hiding?")}
                                ${generateMultiStringField('vulnerabilities', 'Vulnerabilities', data.vulnerabilities, "What's this character's weakness?")}
                            </div>
                            <div id="social-panel" class="dossier-tab-panel hidden space-y-4">
                                ${generateSelectField('faction', 'Faction', factionOptions, data.faction, "The primary faction this character belongs to")}
                                ${generateSelectField('wealthClass', 'Wealth Class', wealthOptions, data.wealthClass, "Where does this character fall in the social order?")}
                                ${generateSelectField('district', 'District', districtOptions, data.district, "Where does this character live or spend the most time?")}
                                ${generateMultiSelectField('allies', 'Allies', characterOptions, data.allies, 'characters', 'fullName', "Characters on this character's side")}
                                ${generateMultiSelectField('enemies', 'Enemies', characterOptions, data.enemies, 'characters', 'fullName', "Characters who hate this character")}
                                ${generateMultiSelectField('items', 'Items', itemOptions, data.items, 'items', 'name', "Items associated with this character")}
                            </div>
                             <div id="narrative-panel" class="dossier-tab-panel hidden space-y-4">
                                ${generateMultiStringField('archetype', 'Archetype', data.archetype, "What type of character is this?")}
                                ${generateMultiStringField('flaws_handicaps_limitations', 'Flaws/Handicaps', data.flaws_handicaps_limitations, "The character's weaknesses, disabilities, or inherent restrictions.")}
                                ${generateMultiStringField('quirks', 'Quirks', data.quirks, "Identifying characteristics that fit their overall design.")}
                                ${generateMultiStringField('characteristics', 'Characteristics', data.characteristics, "Defining characteristics and quirks.")}
                                ${generateMultiStringField('expertise', 'Expertise', data.expertise, "Special knowledge this character has.")}
                                ${generateTextField('voiceModel', 'Voice Model', data.voiceModel, "Describe how this character speaks (e.g. timid, booming, sarcastic)")}
                                ${generateTextareaField('dialogue_style', 'Dialogue Style', data.dialogue_style, "Describe unique patterns of speech.", 4)}
                                <div class="space-y-4">
                                    ${generateRangeField('honesty', 'Honesty', data.honesty, "0% (Lies) to 100% (Truthful)")}
                                    ${generateRangeField('victimLikelihood', 'Victim Likelihood', data.victimLikelihood, "0% (Unlikely) to 100% (Very Likely)")}
                                    ${generateRangeField('killerLikelihood', 'Killer Likelihood', data.killerLikelihood, "0% (Unlikely) to 100% (Very Likely)")}
                                </div>
                                ${generateTextareaField('portrayal_notes', 'Portrayal Notes', data.portrayal_notes, "Notes on how this character should be conveyed.", 4)}
                            </div>
                        </div>
                        ${generateSaveButton()}
                    </form>
                </div>
            `;
        }

        function generateSleuthForm(data = {}) {
            // This form is a variation of the character form, with specific fields adjusted as per the PDF.
            const title = data.name || 'Sleuth Profile';
            const districtOptions = generateOptions(dataCache.districts, data.district, 'district');
            const characterOptions = generateOptions(dataCache.characters, null, 'fullName');
            const wealthOptions = generateOptions([
                { id: '5', name: 'Old Money Rich' }, { id: '4', name: 'New Money Rich' }, { id: '3', name: 'Business Person' },
                { id: '2', name: 'Working Stiff' }, { id: '1', name: 'Poor' }, { id: '0', name: 'Transient' }
            ], data.wealthClass, 'name');
            const genderOptions = generateOptions([
                {id: 'Male', name: 'Male'}, {id: 'Female', name: 'Female'}, {id: 'Nonbinary', name: 'Nonbinary'},
                {id: 'Trans Man', name: 'Trans Man'}, {id: 'Trans Woman', name: 'Trans Woman'},
                {id: 'Unknown', name: 'Unknown'}, {id: 'Unspecified', name: 'Unspecified'}
            ], data.gender, 'name');

            return `
                ${generateDossierHeader(title, [
                    { id: 'identity', name: 'Identity' }, { id: 'psychology', name: 'Psychology' },
                    { id: 'social', name: 'Social' }, { id: 'narrative', name: 'Narrative' }
                ])}
                <div class="bg-[var(--form-bg)] rounded-lg shadow-2xl text-[var(--form-text)] relative dossier-panel rounded-tl-none">
                    <form id="asset-form" data-id="${data.id || ''}">
                        <div class="p-6">
                            <div id="identity-panel" class="dossier-tab-panel">
                                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div class="lg:col-span-1">${generateImageUploader(data.image, 'Sleuth Portrait')}</div>
                                    <div class="lg:col-span-2 space-y-4">
                                        ${generateTextField('name', 'Name', data.name, "The sleuth's name")}
                                        ${generateTextField('city', 'City', data.city, "The setting for the story")}
                                        <div class="grid grid-cols-2 gap-4">
                                            ${generateNumberField('age', 'Age', data.age, "The sleuth's age")}
                                            ${generateSelectField('gender', 'Gender', genderOptions, data.gender, "The sleuth's gender")}
                                        </div>
                                        ${generateTextField('employment', 'Employment', data.employment, "The sleuth's occupation or role in the world")}
                                        ${generateTextareaField('biography', 'Biography', data.biography, "Who is the sleuth? Their backstory...", 6)}
                                    </div>
                                </div>
                            </div>
                            <div id="psychology-panel" class="dossier-tab-panel hidden space-y-4">
                                ${generateAlignmentGrid(data.alignment)}
                                ${generateMultiStringField('personality', 'Personality', data.personality, "The sleuth's core personality traits...")}
                                ${generateMultiStringField('values', 'Values', data.values, "Fundamental principles or beliefs...")}
                                ${generateMultiStringField('motivations', 'Motivations', data.motivations, "What drives the sleuth?")}
                                ${generateMultiStringField('secrets', 'Secrets', data.secrets, "What secrets is the sleuth hiding?")}
                                ${generateMultiStringField('vulnerabilities', 'Vulnerabilities', data.vulnerabilities, "What's the sleuth's weakness?")}
                            </div>
                            <div id="social-panel" class="dossier-tab-panel hidden space-y-4">
                                ${generateSelectField('wealthClass', 'Wealth Class', wealthOptions, data.wealthClass, "Where does the sleuth fall in the social order?")}
                                ${generateSelectField('district', 'District', districtOptions, data.district, "Where does the sleuth live or spend the most time?")}
                                ${generateMultiSelectField('relationships', 'Relationships', characterOptions, data.relationships, 'characters', 'fullName', "Friends and family of the sleuth")}
                                ${generateMultiSelectField('nemesis', 'Nemesis', characterOptions, data.nemesis, 'characters', 'fullName', "The sleuth's enemies")}
                            </div>
                             <div id="narrative-panel" class="dossier-tab-panel hidden space-y-4">
                                ${generateMultiStringField('archetype', 'Archetype', data.archetype, "What type of character is the sleuth?")}
                                ${generateTextareaField('primary_arc', 'Primary Arc', data.primary_arc, "The main internal or external journey the sleuth undergoes.", 4)}
                                ${generateMultiStringField('flaws_handicaps_limitations', 'Flaws/Handicaps', data.flaws_handicaps_limitations, "The sleuth's weaknesses, disabilities, or inherent restrictions.")}
                                ${generateMultiStringField('quirks', 'Quirks', data.quirks, "Identifying characteristics that fit their overall design.")}
                                ${generateMultiStringField('characteristics', 'Characteristics', data.characteristics, "Defining characteristics and quirks.")}
                                ${generateMultiStringField('expertise', 'Expertise', data.expertise, "Special knowledge the sleuth has.")}
                                ${generateTextField('voiceModel', 'Voice Model', data.voiceModel, "Describe how the sleuth speaks (e.g. gruff, proper, nervous)")}
                                ${generateTextareaField('dialogue_style', 'Dialogue Style', data.dialogue_style, "Describe unique patterns of speech.", 4)}
                                ${generateTextareaField('portrayal_notes', 'Portrayal Notes', data.portrayal_notes, "Notes on how the sleuth should be conveyed.", 4)}
                            </div>
                        </div>
                        ${generateSaveButton()}
                    </form>
                </div>
            `;
        }
        
        function generateDistrictForm(data = {}) {
            const title = data.district || 'New District';
            const locationOptions = generateOptions(dataCache.locations, null, 'name');
            const factionOptions = generateOptions(dataCache.factions, data.dominant_faction, 'name');
            const wealthOptions = generateOptions([
                { id: '5', name: 'Old Money Rich' }, { id: '4', name: 'New Money Rich' }, { id: '3', name: 'Business Person' },
                { id: '2', name: 'Working Stiff' }, { id: '1', name: 'Poor' }, { id: '0', name: 'Transient' }
            ], data.wealthClass, 'name');
            const densityOptions = generateOptions([{id:'Sparse'}, {id:'Moderate'}, {id:'Dense'}, {id:'Crowded'}], data.populationDensity, 'id');

            return `
                ${generateDossierHeader(title, [{ id: 'main', name: 'Main Details' }])}
                <div class="dossier-panel rounded-tl-none">
                    <form id="asset-form" data-id="${data.id || ''}">
                        <div class="p-6">
                            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div class="lg:col-span-1">${generateImageUploader(data.image, 'District Image')}</div>
                                <div class="lg:col-span-2 space-y-4">
                                    ${generateTextField('district', 'District Name', data.district, 'The name of the district')}
                                    ${generateTextareaField('description', 'Description', data.description, 'A detailed description of the district...', 5)}
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        ${generateSelectField('wealthClass', 'Wealth Class', wealthOptions, data.wealthClass, 'The predominant wealth class')}
                                        ${generateSelectField('populationDensity', 'Population Density', densityOptions, data.populationDensity, 'How many people typically inhabit this district?')}
                                    </div>
                                     ${generateTextField('atmosphere', 'Atmosphere', data.atmosphere, 'Describe the general mood or feeling of the district')}
                                     ${generateMultiStringField('notableFeatures', 'Notable Features', data.notableFeatures, 'Unique landmarks or characteristics')}
                                     ${generateSelectField('dominant_faction', 'Dominant Faction', factionOptions, data.dominant_faction, 'The primary faction that controls this district')}
                                     ${generateMultiSelectField('keyLocations', 'Key Locations', locationOptions, data.keyLocations, 'locations', 'name', 'Important locations within this district')}
                                </div>
                            </div>
                        </div>
                        ${generateSaveButton()}
                    </form>
                </div>
            `;
        }
        
        // --- TEMPLATE HELPER FUNCTIONS ---
        function generateDossierHeader(title, tabs = []) {
            const tabButtons = tabs.map((tab, index) => 
                `<button type="button" data-target="${tab.id}-panel" class="dossier-sub-tab ${index === 0 ? 'active' : ''}">${tab.name}</button>`
            ).join('');

            return `
                <div class="dossier-header">
                    <div class="dossier-tab font-poiret font-bold text-2xl shadow-lg">${title}</div>
                    <div class="dossier-sub-tabs">${tabButtons}</div>
                </div>`;
        }
        
        function generateTextField(name, label, value = '', tooltip = '') {
            return `
                <div class="tooltip-container">
                    <label for="${name}" class="form-label">${label}</label>
                    <input type="text" id="${name}" name="${name}" class="form-input" value="${value || ''}">
                    ${tooltip ? `<span class="tooltip-text">${tooltip}</span>` : ''}
                </div>`;
        }

        function generateTextareaField(name, label, value = '', tooltip = '', rows = 4) {
            return `
                <div class="tooltip-container">
                    <label for="${name}" class="form-label">${label}</label>
                    <textarea id="${name}" name="${name}" rows="${rows}" class="form-textarea">${value || ''}</textarea>
                    ${tooltip ? `<span class="tooltip-text">${tooltip}</span>` : ''}
                </div>`;
        }
        
        function generateNumberField(name, label, value = '', tooltip = '', step = 1, min = '', max = '') {
            return `
                <div class="tooltip-container">
                    <label for="${name}" class="form-label">${label}</label>
                    <input type="number" id="${name}" name="${name}" class="form-input" value="${value || ''}" step="${step}" min="${min}" max="${max}">
                    ${tooltip ? `<span class="tooltip-text">${tooltip}</span>` : ''}
                </div>`;
        }

        function generateRangeField(name, label, value = 0, tooltip = '') {
            const percentage = Math.round((value || 0) * 100);
            return `
                <div class="tooltip-container">
                    <label for="${name}" class="form-label flex justify-between">
                        <span>${label}</span>
                        <span class="range-value">${percentage}%</span>
                    </label>
                    <input type="range" id="${name}" name="${name}" class="form-range" min="0" max="1" step="0.01" value="${value || 0}">
                    ${tooltip ? `<span class="tooltip-text">${tooltip}</span>` : ''}
                </div>
            `;
        }

        function generateSelectField(name, label, optionsHTML, selectedValue = '', tooltip = '') {
             return `
                <div class="tooltip-container">
                    <label for="${name}" class="form-label">${label}</label>
                    <select id="${name}" name="${name}" class="form-select">
                        <option value="">-- Select --</option>
                        ${optionsHTML}
                    </select>
                    ${tooltip ? `<span class="tooltip-text">${tooltip}</span>` : ''}
                </div>`;
        }

        function generateMultiSelectField(name, label, optionsHTML, selectedIds = [], collection, nameKey, tooltip = '') {
            return `
                <div class="tooltip-container">
                    <label class="form-label">${label}</label>
                    <div class="multi-select-container" data-name="${name}" data-collection="${collection}" data-name-key="${nameKey}">
                        <div class="selected-items"></div>
                        <select class="form-select">
                            <option value="">-- Add ${label.slice(0,-1)} --</option>
                            ${optionsHTML}
                        </select>
                    </div>
                    ${tooltip ? `<span class="tooltip-text">${tooltip}</span>` : ''}
                </div>`;
        }
        
        function generateMultiStringField(name, label, value = [], tooltip = '') {
            const tags = (Array.isArray(value) ? value : (value || '').split(',').map(s=>s.trim()).filter(Boolean))
                         .map(tag => `<div class="tag"><span>${tag}</span><span class="tag-remove">&times;</span></div>`).join('');
            return `
                <div class="tooltip-container">
                    <label class="form-label">${label}</label>
                    <div class="tag-container" data-name="${name}">
                        ${tags}
                        <input type="text" class="tag-input" placeholder="Add and press Enter...">
                    </div>
                     ${tooltip ? `<span class="tooltip-text">${tooltip}</span>` : ''}
                </div>
            `;
        }

        function generateCheckboxField(name, label, checked = false, tooltip = '') {
            return `
                <div class="tooltip-container flex items-center space-x-2">
                    <input type="checkbox" id="${name}" name="${name}" class="form-checkbox" ${checked ? 'checked' : ''}>
                    <label for="${name}" class="form-label mb-0">${label}</label>
                    ${tooltip ? `<span class="tooltip-text">${tooltip}</span>` : ''}
                </div>`;
        }
        
        function generateAlignmentGrid(selectedValue) {
            const cells = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil']
                .map(a => `<div class="alignment-cell ${selectedValue === a ? 'selected' : ''}" data-value="${a}">${a}</div>`).join('');
            return `
                <div class="tooltip-container">
                    <label class="form-label">Alignment</label>
                    <div class="alignment-grid">${cells}</div>
                    <input type="hidden" name="alignment" value="${selectedValue || ''}">
                    <span class="tooltip-text">How does this character align on the Good-Evil scale?</span>
                </div>`;
        }

        function generateImageUploader(imageUrl, altText) {
            const inputId = `image-upload-${Math.random().toString(36).substring(2, 9)}`;
            return `
                <div class="space-y-2">
                    <label for="${inputId}" class="cursor-pointer group">
                        <div class="relative">
                            <img src="${imageUrl || 'https://placehold.co/400x600/1f2937/9ca3af?text=Upload+Image'}" alt="${altText}" class="w-full h-auto object-cover rounded-md border-4 border-[var(--form-border)] shadow-md">
                            <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span class="text-white font-poiret text-xl">Upload Image</span>
                            </div>
                        </div>
                        <input type="file" id="${inputId}" class="image-upload-input hidden" accept="image/*">
                    </label>
                    <input type="hidden" name="image" value="${imageUrl || ''}">
                    <div class="upload-status text-xs text-center"></div>
                </div>`;
        }

        function generateSaveButton() {
            return `
                <div class="pt-6 flex justify-end">
                    <button type="submit" id="save-form-btn" class="py-2 px-8 rounded-md btn-dossier text-lg shadow-lg">Save Changes</button>
                </div>`;
        }
        
        function generateOptions(items, selectedId, nameKey) {
            if (!items) return '';
            return items.map(item => `<option value="${item.id || item}" ${selectedId === (item.id || item) ? 'selected' : ''}>${item[nameKey] || item}</option>`).join('');
        }
        
        function generateComingSoon(name) {
             return `<div class="p-6"><h2 class="text-2xl gold-text font-poiret">${name} form coming soon.</h2></div>`;
        }
        
        // Stubs for other forms - to be implemented
        function generateLocationForm(data = {}) {
            const title = data.name || 'New Location';
            const districtOptions = generateOptions(dataCache.districts, data.district, 'district');
            const factionOptions = generateOptions(dataCache.factions, data.owning_faction, 'name');
            const characterOptions = generateOptions(dataCache.characters, null, 'fullName');
            const itemOptions = generateOptions(dataCache.items, null, 'name');
            const clueOptions = generateOptions(dataCache.clues, null, 'clue_summary');
            
            const dangerLevels = generateOptions([
                {id: '1', name: 'Safe'}, {id: '2', name: 'Low Risk'}, {id: '3', name: 'Moderate Risk'},
                {id: '4', name: 'High Risk'}, {id: '5', name: 'Deadly'}
            ], data.danger_level, 'name');
            
            const accessibilityOptions = generateOptions([
                {id: 'Public'}, {id: 'Semi-Private'}, {id: 'Private'}, {id: 'Restricted'}
            ], data.accessibility, 'id');

            return `
                ${generateDossierHeader(title, [
                    { id: 'main', name: 'Main' },
                    { id: 'associations', name: 'Associations' },
                    { id: 'details', name: 'Details' }
                ])}
                <div class="bg-[var(--form-bg)] rounded-lg shadow-2xl text-[var(--form-text)] relative dossier-panel rounded-tl-none">
                    <form id="asset-form" data-id="${data.id || ''}">
                        <div class="p-6">
                            <div id="main-panel" class="dossier-tab-panel">
                                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div class="lg:col-span-1">${generateImageUploader(data.image, 'Location Image')}</div>
                                    <div class="lg:col-span-2 space-y-4">
                                        ${generateTextField('name', 'Name', data.name, 'The name of the location.')}
                                        ${generateTextField('type', 'Type', data.type, 'What kind of location is it? (e.g., House, Shop, Park, Office)')}
                                        ${generateTextareaField('description', 'Description', data.description, 'A detailed description of the location, its appearance, purpose, and key sensory details.', 6)}
                                    </div>
                                </div>
                            </div>
                            <div id="associations-panel" class="dossier-tab-panel hidden space-y-4">
                                ${generateSelectField('district', 'District', districtOptions, data.district, 'The district where this location is situated.')}
                                ${generateSelectField('owning_faction', 'Owning Faction', factionOptions, data.owning_faction, 'The faction that owns or controls this location.')}
                                ${generateMultiSelectField('key_characters', 'Key Characters', characterOptions, data.key_characters, 'characters', 'fullName', 'Characters frequently found or associated with this location.')}
                                ${generateMultiSelectField('associated_items', 'Associated Items', itemOptions, data.associated_items, 'items', 'name', 'Items commonly found or hidden at this location.')}
                            </div>
                            <div id="details-panel" class="dossier-tab-panel hidden space-y-4">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    ${generateSelectField('danger_level', 'Danger Level', dangerLevels, data.danger_level, 'How dangerous is this location?')}
                                    ${generateNumberField('population', 'Population', data.population, 'The typical number of people present for interviews.')}
                                </div>
                                ${generateSelectField('accessibility', 'Accessibility', accessibilityOptions, data.accessibility, 'How easy is it for the public to access this location?')}
                                ${generateCheckboxField('hidden', 'Hidden', data.hidden, 'Is this location hidden to the sleuth until a witness tells them about it?')}
                                ${generateTextareaField('internal_logic_notes', 'Internal Logic Notes', data.internal_logic_notes, 'Notes on how this location adheres to or deviates from the rules of the game world.', 4)}
                                ${generateMultiSelectField('clues', 'Clues', clueOptions, data.clues, 'clues', 'clue_summary', 'Potential clues that might be found here.')}
                            </div>
                        </div>
                        ${generateSaveButton()}
                    </form>
                </div>
            `;
        }
        function generateFactionForm(data = {}) {
            const title = data.name || 'New Faction';
            const locationOptions = generateOptions(dataCache.locations, data.headquarters, 'name');
            const factionOptions = generateOptions(dataCache.factions, null, 'name');
            const characterOptions = generateOptions(dataCache.characters, null, 'fullName');
            
            const influenceOptions = generateOptions([
                {id: 'Local'}, {id: 'District-wide'}, {id: 'City-wide'}, {id: 'Regional'}, {id: 'Global'}
            ], data.influence, 'id');

            return `
                ${generateDossierHeader(title, [
                    { id: 'main', name: 'Main' },
                    { id: 'relations', name: 'Relations' }
                ])}
                <div class="bg-[var(--form-bg)] rounded-lg shadow-2xl text-[var(--form-text)] relative dossier-panel rounded-tl-none">
                    <form id="asset-form" data-id="${data.id || ''}">
                        <div class="p-6">
                            <div id="main-panel" class="dossier-tab-panel">
                                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div class="lg:col-span-1">${generateImageUploader(data.image, 'Faction Image')}</div>
                                    <div class="lg:col-span-2 space-y-4">
                                        ${generateTextField('name', 'Name', data.name, 'The name of the faction.')}
                                        ${generateTextField('archetype', 'Archetype', data.archetype, 'What kind of faction is it?')}
                                        ${generateTextareaField('description', 'Description', data.description, 'A detailed description of the faction.', 6)}
                                        ${generateTextareaField('ideology', 'Ideology', data.ideology, 'The core beliefs or principles that guide the faction.', 4)}
                                    </div>
                                </div>
                            </div>
                            <div id="relations-panel" class="dossier-tab-panel hidden space-y-4">
                                ${generateSelectField('headquarters', 'Headquarters', locationOptions, data.headquarters, 'The primary base of operations for the faction.')}
                                ${generateTextField('resources', 'Resources', data.resources, 'What resources does this faction control or possess?')}
                                ${generateSelectField('influence', 'Influence', influenceOptions, data.influence, 'The scope of the faction\'s influence.')}
                                ${generateTextField('public_perception', 'Public Perception', data.public_perception, 'How is this faction generally perceived by the public?')}
                                ${generateMultiSelectField('ally_factions', 'Ally Factions', factionOptions, data.ally_factions, 'factions', 'name', 'Other factions allied with this one.')}
                                ${generateMultiSelectField('enemy_factions', 'Enemy Factions', factionOptions, data.enemy_factions, 'factions', 'name', 'Factions that are adversaries to this one.')}
                                ${generateMultiSelectField('members', 'Members', characterOptions, data.members, 'characters', 'fullName', 'Key members or leaders of the faction.')}
                            </div>
                        </div>
                        ${generateSaveButton()}
                    </form>
                </div>
            `;
        }
        function generateItemForm(data = {}) {
            const title = data.name || 'New Item';
            const locationOptions = generateOptions(dataCache.locations, data.default_location, 'name');
            const characterOptions = generateOptions(dataCache.characters, data.default_owner, 'fullName');

            const conditionOptions = generateOptions([
                {id: 'New'}, {id: 'Good'}, {id: 'Used'}, {id: 'Worn'}, {id: 'Damaged'}, {id: 'Broken'}
            ], data.condition, 'id');

            const cluePotentialOptions = generateOptions([
                {id: 'None'}, {id: 'Low'}, {id: 'Medium'}, {id: 'High'}, {id: 'Critical'}
            ], data.clue_potential, 'id');

            return `
                ${generateDossierHeader(title, [
                    { id: 'main', name: 'Main' },
                    { id: 'details', name: 'Details' }
                ])}
                <div class="bg-[var(--form-bg)] rounded-lg shadow-2xl text-[var(--form-text)] relative dossier-panel rounded-tl-none">
                    <form id="asset-form" data-id="${data.id || ''}">
                        <div class="p-6">
                            <div id="main-panel" class="dossier-tab-panel">
                                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div class="lg:col-span-1">${generateImageUploader(data.image, 'Item Image')}</div>
                                    <div class="lg:col-span-2 space-y-4">
                                        ${generateTextField('name', 'Item Name', data.name, 'The name of the item.')}
                                        ${generateTextField('type', 'Type', data.type, 'What kind of item is it? (e.g., Weapon, Document, Key, Tool, Clothing)')}
                                        ${generateTextareaField('description', 'Description', data.description, 'A detailed description of the item, its appearance, and its history.', 6)}
                                        ${generateTextField('use', 'Use', data.use, 'How can this item be used or what is its purpose?')}
                                        ${generateTextField('unique_properties', 'Unique Properties', data.unique_properties, 'Any special or unique properties this item possesses.')}
                                    </div>
                                </div>
                            </div>
                            <div id="details-panel" class="dossier-tab-panel hidden space-y-4">
                                ${generateSelectField('default_location', 'Default Location', locationOptions, data.default_location, 'Where is this item typically found or stored?')}
                                ${generateSelectField('default_owner', 'Default Owner', characterOptions, data.default_owner, 'Who is the primary owner or possessor of this item?')}
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    ${generateSelectField('condition', 'Condition', conditionOptions, data.condition, 'The physical condition of the item.')}
                                    ${generateTextField('value', 'Value', data.value, 'The monetary or sentimental value of the item.')}
                                </div>
                                ${generateSelectField('clue_potential', 'Clue Potential', cluePotentialOptions, data.clue_potential, 'How likely is this item to be a crucial clue?')}
                                ${generateTextField('significance', 'Significance', data.significance, 'What is the likely importance or significance of this item to the plot or characters?')}
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                                    ${generateCheckboxField('possible_means', 'Possible Means', data.possible_means, 'Can this item be used as a means to commit a crime?')}
                                    ${generateCheckboxField('possible_motive', 'Possible Motive', data.possible_motive, 'Is this item related to a motive for a crime?')}
                                    ${generateCheckboxField('possible_opportunity', 'Possible Opportunity', data.possible_opportunity, 'Does this item provide an opportunity for a crime?')}
                                </div>
                            </div>
                        </div>
                        ${generateSaveButton()}
                    </form>
                </div>
            `;
        }
        function generateCaseMetaForm(data = {}) {
            const title = data.case_title || 'Case Meta';
            const victimOptions = generateOptions(dataCache.characters, data.victim, 'fullName');
            const culpritOptions = generateOptions(dataCache.characters, data.culprit, 'fullName');

            return `
                ${generateDossierHeader(title, [{ id: 'main', name: 'Main Details' }])}
                <div class="dossier-panel rounded-tl-none">
                    <form id="asset-form" data-id="${data.id || ''}">
                        <div class="p-6 space-y-4">
                            ${generateTextField('case_title', 'Case Title', data.case_title, 'The title of the case.')}
                            ${generateTextareaField('case_brief', 'Case Brief', data.case_brief, 'A brief description of the case.', 5)}
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                ${generateSelectField('victim', 'Victim', victimOptions, data.victim, 'The victim of the case.')}
                                ${generateSelectField('culprit', 'Culprit', culpritOptions, data.culprit, 'The culprit of the case.')}
                            </div>
                            ${generateTextareaField('resolution', 'Resolution', data.resolution, 'The resolution of the case.', 5)}
                        </div>
                        ${generateSaveButton()}
                    </form>
                </div>
            `;
        }
        function generateClueForm(data = {}) {
            const title = data.clue_summary || 'New Clue';
            const characterOptions = generateOptions(dataCache.characters, null, 'fullName');
            const locationOptions = generateOptions(dataCache.locations, null, 'name');
            const itemOptions = generateOptions(dataCache.items, null, 'name');

            const discoveryMethods = generateOptions([
                {id: 'Investigation'}, {id: 'Interview'}, {id: 'Finding'}, {id: 'Given'}
            ], data.discovery_method, 'id');

            return `
                ${generateDossierHeader(title, [
                    { id: 'main', name: 'Main' },
                    { id: 'associations', name: 'Associations' }
                ])}
                <div class="bg-[var(--form-bg)] rounded-lg shadow-2xl text-[var(--form-text)] relative dossier-panel rounded-tl-none">
                    <form id="asset-form" data-id="${data.id || ''}">
                        <div class="p-6">
                            <div id="main-panel" class="dossier-tab-panel space-y-4">
                                ${generateTextField('clue_summary', 'Clue Summary', data.clue_summary, 'A brief summary of the clue.')}
                                ${generateTextareaField('detailed_description', 'Detailed Description', data.detailed_description, 'A detailed description of the clue.', 5)}
                                ${generateSelectField('discovery_method', 'Discovery Method', discoveryMethods, data.discovery_method, 'How is this clue discovered?')}
                                ${generateCheckboxField('is_critical', 'Critical Clue', data.is_critical, 'Is this clue critical to solving the case?')}
                            </div>
                            <div id="associations-panel" class="dossier-tab-panel hidden space-y-4">
                                ${generateMultiSelectField('related_characters', 'Related Characters', characterOptions, data.related_characters, 'characters', 'fullName', 'Characters related to this clue.')}
                                ${generateMultiSelectField('related_locations', 'Related Locations', locationOptions, data.related_locations, 'locations', 'name', 'Locations related to this clue.')}
                                ${generateMultiSelectField('related_items', 'Related Items', itemOptions, data.related_items, 'items', 'name', 'Items related to this clue.')}
                            </div>
                        </div>
                        ${generateSaveButton()}
                    </form>
                </div>
            `;
        }


        // --- EVENT LISTENERS & HANDLERS ---
        function attachFormEventListeners(collectionName) {
            const form = document.getElementById('asset-form');
            if (!form) return;

            // Dossier Tabs
            const tabContainer = document.querySelector('.dossier-sub-tabs');
            if (tabContainer) {
                tabContainer.addEventListener('click', (e) => {
                    if (e.target.classList.contains('dossier-sub-tab')) {
                        tabContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                        e.target.classList.add('active');
                        document.querySelectorAll('.dossier-tab-panel').forEach(panel => {
                            panel.classList.toggle('hidden', panel.id !== e.target.dataset.target);
                        });
                    }
                });
            }
            
            form.querySelector('.image-upload-input')?.addEventListener('change', handleImageUpload);
            
            form.querySelectorAll('.form-range').forEach(range => {
                const valueSpan = range.previousElementSibling.querySelector('.range-value');
                range.addEventListener('input', (e) => {
                    valueSpan.textContent = `${Math.round(e.target.value * 100)}%`;
                });
            });
            
            const alignmentGrid = form.querySelector('.alignment-grid');
            if (alignmentGrid) {
                const alignmentInput = form.querySelector('input[name="alignment"]');
                alignmentGrid.addEventListener('click', (e) => {
                    if (e.target.classList.contains('alignment-cell')) {
                        alignmentGrid.querySelectorAll('.alignment-cell').forEach(cell => cell.classList.remove('selected'));
                        e.target.classList.add('selected');
                        alignmentInput.value = e.target.dataset.value;
                    }
                });
            }
            
            form.querySelectorAll('.tag-container').forEach(container => {
                const input = container.querySelector('.tag-input');
                container.addEventListener('click', (e) => {
                    if (e.target.classList.contains('tag-remove')) {
                        e.target.parentElement.remove();
                    }
                });
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && input.value.trim() !== '') {
                        e.preventDefault();
                        const tag = document.createElement('div');
                        tag.className = 'tag';
                        tag.innerHTML = `<span>${input.value.trim()}</span><span class="tag-remove">&times;</span>`;
                        container.insertBefore(tag, input);
                        input.value = '';
                    }
                });
            });
            
            form.querySelectorAll('.multi-select-container').forEach(container => {
                const select = container.querySelector('select');
                const selectedItemsContainer = container.querySelector('.selected-items');
                
                select.addEventListener('change', () => {
                    const selectedOption = select.options[select.selectedIndex];
                    const id = selectedOption.value;
                    if (id && !selectedItemsContainer.querySelector(`[data-id="${id}"]`)) {
                        const itemData = {
                            id: id,
                            [container.dataset.nameKey]: selectedOption.text
                        };
                        addSelectedItem(itemData, container);
                    }
                    select.value = ''; // Reset select
                });
                
                // Initial render of selected items
                const selectedIds = (form.querySelector(`input[name="${container.dataset.name}"]`)?.value || '').split(',');
                selectedIds.forEach(id => {
                    const itemData = dataCache[container.dataset.collection]?.find(i => i.id === id);
                    if (itemData) addSelectedItem(itemData, container);
                });
            });

            form.addEventListener('submit', handleFormSubmit);
        }
        
        function addSelectedItem(itemData, container) {
            const selectedItemsContainer = container.querySelector('.selected-items');
            const nameKey = container.dataset.nameKey;
            const itemEl = document.createElement('div');
            itemEl.className = 'tag';
            itemEl.dataset.id = itemData.id;
            itemEl.innerHTML = `<span>${itemData[nameKey] || itemData.name || 'Unknown'}</span><span class="tag-remove">&times;</span>`;
            itemEl.querySelector('.tag-remove').addEventListener('click', () => itemEl.remove());
            selectedItemsContainer.appendChild(itemEl);
        }

        async function handleFormSubmit(e) {
            e.preventDefault();
            const form = e.target;
            const id = form.dataset.id;
            const saveBtn = form.querySelector('#save-form-btn');
            
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            
            const payload = {};
            const formData = new FormData(form);

            for (let [key, value] of formData.entries()) {
                payload[key] = value;
            }
            
            form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                payload[cb.name] = cb.checked;
            });
            
            form.querySelectorAll('.tag-container').forEach(container => {
                const name = container.dataset.name;
                payload[name] = Array.from(container.querySelectorAll('.tag > span:first-child')).map(span => span.textContent);
            });
            
            form.querySelectorAll('.multi-select-container').forEach(container => {
                const name = container.dataset.name;
                payload[name] = Array.from(container.querySelectorAll('.tag')).map(tag => tag.dataset.id);
            });

            try {
                if (id) {
                    await setDoc(doc(db, currentCollection, id), payload, { merge: true });
                    showNotification('Changes saved successfully!', 'success');
                } else {
                    const docRef = await addDoc(collection(db, currentCollection), payload);
                    // This is a new document, so we need to reload the form with the new ID
                    displayAssetForm(currentCollection, { id: docRef.id, ...payload });
                    showNotification('Asset created successfully!', 'success');
                }
            } catch (error) {
                console.error("Error saving document:", error);
                showNotification(`Error: ${error.message}`, 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Changes';
            }
        }

        function handleNewAsset() {
            const isSingleton = currentCollection === 'sleuth' || currentCollection === 'case_meta';
            if (isSingleton) return;
            // Simply display a blank form. The document will be created on first save.
            displayAssetForm(currentCollection, {});
        }
        
        async function handleImageUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            const uploaderContainer = event.target.closest('.space-y-2');
            const statusDiv = uploaderContainer.querySelector('.upload-status');
            const hiddenInput = uploaderContainer.querySelector('input[type="hidden"]');
            const previewImg = uploaderContainer.querySelector('img');

            statusDiv.textContent = 'Uploading...';
            statusDiv.style.color = 'var(--gold-accent)';

            try {
                const authResponse = await fetch('http://localhost:3001/auth');
                if (!authResponse.ok) {
                    throw new Error(`Authentication failed with status: ${authResponse.status}`);
                }
                const authParams = await authResponse.json();

                const result = await imagekit.upload({
                    file: file,
                    fileName: file.name,
                    ...authParams
                });
                
                statusDiv.textContent = 'Upload successful!';
                statusDiv.style.color = 'green';
                hiddenInput.value = result.url;
                previewImg.src = result.url;
                setTimeout(() => statusDiv.textContent = '', 3000);

            } catch (error) {
                console.error('ImageKit Upload Error:', error);
                statusDiv.textContent = `Upload failed.`;
                statusDiv.style.color = 'red';
            }
        }
        
        function showConfirmationModal(id, name) {
            const modalText = modal.querySelector('#modal-text');
            modalText.textContent = `Are you sure you want to delete "${name}"? This action cannot be undone.`;
            modal.classList.add('visible');
            
            modalConfirmBtn.onclick = async () => {
                try {
                    await deleteDoc(doc(db, currentCollection, id));
                    showNotification(`"${name}" was deleted.`, 'success');
                    if (id === currentDocId) {
                        mainContent.innerHTML = `<div class="h-full flex items-center justify-center"><div class="text-center text-gray-500"><p>Select an item from the left panel or create a new one.</p></div></div>`;
                        currentDocId = null;
                    }
                } catch (error) {
                     showNotification(`Error deleting: ${error.message}`, 'error');
                } finally {
                    modal.classList.remove('visible');
                }
            };
            modalCancelBtn.onclick = () => {
                modal.classList.remove('visible');
            };
        }
        
        function showNotification(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = `notification-toast ${type}`;
            toast.textContent = message;
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.classList.add('show');
            }, 10);

            setTimeout(() => {
                toast.classList.remove('show');
                toast.addEventListener('transitionend', () => toast.remove());
            }, 4000);
        }
    