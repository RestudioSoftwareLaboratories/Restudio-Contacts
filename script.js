// ========== SECURITY UTILITIES ==========

function sanitizeText(text) {
    if (text === null || text === undefined) return '';
    if (typeof text !== 'string') return String(text);
    var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '=': '&#x3D;',
        '`': '&#x60;'
    };
    return text.replace(/[&<>"'/=`]/g, function(match) {
        return map[match];
    });
}

function isValidText(text) {
    if (typeof text !== 'string') return false;
    var dangerousPatterns = [
        /javascript:/i,
        /on\w+\s*=/i,
        /<script/i,
        /<iframe/i,
        /<object/i,
        /<embed/i,
        /data:text\/html/i,
        /vbscript:/i
    ];
    for (var i = 0; i < dangerousPatterns.length; i++) {
        if (dangerousPatterns[i].test(text)) return false;
    }
    return true;
}

function validateEmail(email) {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateCoordinates(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    if (isNaN(lat) || isNaN(lng)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lng < -180 || lng > 180) return false;
    return true;
}

function validateFile(file) {
    var MAX_SIZE = 5 * 1024 * 1024;
    var allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
    if (file.size > MAX_SIZE) return false;
    if (allowedTypes.indexOf(file.type) === -1) return false;
    return true;
}

// ========== MAIN APPLICATION ==========

(function() {
    'use strict';

    var STORAGE_KEY_CONTACTS = 'swrh_contacts_pro_v2';
    var STORAGE_KEY_GROUPS = 'swrh_groups_pro_v2';
    var DEFAULT_AVATAR = 'https://i.postimg.cc/kXcs5vzW/lqtt-shasht-2026-05-23-011056.png';
    var AVATAR_OPTIONS = [
        DEFAULT_AVATAR,
        'https://i.postimg.cc/YqnFVnJ0/glyphs-1779945208550.png',
        'https://i.postimg.cc/xdHbX0qk/shapes-1779945226820.png',
        'https://i.postimg.cc/mDs1M0FX/stripes-1779945220694.png',
        'https://i.postimg.cc/8ckFXM4p/initial-face-1779945199040.png'
    ];

    var contacts = [], groups = [], activeView = 'create', editingContactId = null, editingGroupId = null;
    var chartInstance = null;
    var currentFilter = 'all';
    var currentSort = 'name';
    var searchQuery = '';
    var tempFiles = [];

    function loadData() {
        try {
            var storedContacts = localStorage.getItem(STORAGE_KEY_CONTACTS);
            var storedGroups = localStorage.getItem(STORAGE_KEY_GROUPS);
            contacts = storedContacts ? JSON.parse(storedContacts) : [];
            groups = storedGroups ? JSON.parse(storedGroups) : [];
        } catch (e) { contacts = []; groups = []; }
    }
    
    function saveContacts() { localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts)); }
    function saveGroups() { localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(groups)); }
    function generateId() { return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2,6); }
    function getContactById(id) { return contacts.find(function(c) { return c.id === id; }); }
    
    function updateBadge() {
        var b = document.getElementById('contactCountBadge');
        if (b) b.textContent = contacts.length;
    }
    
    function setActiveSidebarButton(id) {
        document.querySelectorAll('.sidebar .btn-sidebar').forEach(function(b) { b.classList.remove('active'); });
        var el = document.getElementById(id);
        if (el) el.classList.add('active');
    }
    
    function showToast(msg) {
        var t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        document.getElementById('toastContainer').appendChild(t);
        setTimeout(function() { t.remove(); }, 3000);
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // ============ CLEAR DATA ============
    window.clearAllData = function() {
        if (confirm('Warning: This will delete ALL contacts and groups permanently. Are you sure?')) {
            localStorage.removeItem(STORAGE_KEY_CONTACTS);
            localStorage.removeItem(STORAGE_KEY_GROUPS);
            contacts = [];
            groups = [];
            updateBadge();
            showToast('All data cleared successfully.');
            if (activeView === 'contacts') showContactsList();
            else if (activeView === 'groups') showGroupsView();
            else if (activeView === 'stats') showStats();
            else showCreateForm();
        }
    };

    // ============ MODAL ============
    function openContactModal(contact) {
        var hasEmail = contact.email && contact.email.trim().length > 0;
        var locationStr = contact.location ? contact.location.trim() : '';
        var validCoords = null;
        if (locationStr) {
            var parts = locationStr.split(',').map(function(s) { return s.trim(); });
            if (parts.length === 2) {
                var lat = parseFloat(parts[0]);
                var lng = parseFloat(parts[1]);
                if (!isNaN(lat) && !isNaN(lng)) validCoords = { lat: lat, lng: lng };
            }
        }

        var mapHtml = validCoords ? '<div class="modal-map-container" id="modalMap-' + contact.id + '"></div>' : '';

        var customHtml = '';
        if (contact.customFields) {
            for (var key in contact.customFields) {
                if (contact.customFields.hasOwnProperty(key) && contact.customFields[key] && contact.customFields[key].trim()) {
                    customHtml += '<div class="modal-info-item"><i class="ti ti-tag"></i> ' + escapeHtml(key) + ': ' + escapeHtml(contact.customFields[key]) + '</div>';
                }
            }
        }

        var filesHtml = '';
        if (contact.files && contact.files.length) {
            filesHtml = '<div class="modal-file-list">' + contact.files.map(function(f) {
                return '<span class="modal-file-item"><i class="ti ti-paperclip"></i> <a href="' + f.data + '" download="' + escapeHtml(f.name) + '" target="_blank">' + escapeHtml(f.name) + '</a></span>';
            }).join('') + '</div>';
        }

        var birthdayHtml = contact.birthday ? '<div class="modal-info-item"><i class="ti ti-cake"></i> Birthday: ' + escapeHtml(contact.birthday) + '</div>' : '';
        var tagsHtml = contact.tags && contact.tags.length ? '<div class="modal-info-item"><i class="ti ti-tags"></i> ' + contact.tags.map(function(t) { return '<span class="tag-badge">' + escapeHtml(t) + '</span>'; }).join(' ') + '</div>' : '';

        var html = '<div class="modal-overlay" id="modalOverlay" onclick="if(event.target===this) closeModal()">' +
            '<div class="modal-dialog" onclick="event.stopPropagation()">' +
            '<button class="modal-close" onclick="closeModal()"><i class="ti ti-x"></i></button>' +
            '<img class="modal-avatar" src="' + escapeHtml(contact.avatar || DEFAULT_AVATAR) + '" onerror="this.src=\'' + DEFAULT_AVATAR + '\'" alt="Avatar">' +
            '<div class="modal-name">' + escapeHtml(contact.name) + '</div>' +
            '<div class="modal-info">' +
            '<div class="modal-info-item"><i class="ti ti-phone"></i> ' + escapeHtml(contact.phone) + '</div>' +
            (hasEmail ? '<div class="modal-info-item"><i class="ti ti-mail"></i> ' + escapeHtml(contact.email) + '</div>' : '') +
            birthdayHtml +
            (contact.notes ? '<div class="modal-info-item"><i class="ti ti-notes"></i> ' + escapeHtml(contact.notes) + '</div>' : '') +
            (locationStr ? '<div class="modal-info-item"><i class="ti ti-map-pin"></i> ' + escapeHtml(locationStr) + '</div>' : '') +
            customHtml +
            tagsHtml +
            (filesHtml ? '<div class="modal-info-item"><i class="ti ti-folder"></i> Attachments: ' + filesHtml + '</div>' : '') +
            '</div>' +
            mapHtml +
            '<div class="modal-actions">' +
            (hasEmail ? '<a href="mailto:' + escapeHtml(contact.email) + '" class="modal-btn"><i class="ti ti-mail"></i> Mail</a>' : '') +
            '<a href="tel:' + escapeHtml(contact.phone) + '" class="modal-btn"><i class="ti ti-phone"></i> Call</a>' +
            '<button class="modal-btn" onclick="editContact(\'' + contact.id + '\'); closeModal();"><i class="ti ti-edit"></i> Edit</button>' +
            '<button class="modal-btn danger" onclick="deleteContact(\'' + contact.id + '\'); closeModal();"><i class="ti ti-trash"></i> Delete</button>' +
            '</div></div></div>';

        document.getElementById('modalContainer').innerHTML = html;

        if (validCoords) {
            setTimeout(function() {
                var mapEl = document.getElementById('modalMap-' + contact.id);
                if (mapEl && typeof maplibregl !== 'undefined') {
                    var map = new maplibregl.Map({
                        container: 'modalMap-' + contact.id,
                        style: {
                            version: 8,
                            sources: {
                                'osm-tiles': {
                                    type: 'raster',
                                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                                    tileSize: 256,
                                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                }
                            },
                            layers: [{ id: 'osm-tiles-layer', type: 'raster', source: 'osm-tiles', minzoom: 0, maxzoom: 19 }]
                        },
                        center: [validCoords.lng, validCoords.lat],
                        zoom: 14,
                        attributionControl: false
                    });
                    new maplibregl.Marker().setLngLat([validCoords.lng, validCoords.lat]).addTo(map);
                }
            }, 50);
        }
    }

    window.closeModal = function() { document.getElementById('modalContainer').innerHTML = ''; };

    // ============ AVATAR HELPERS ============
    window.selectAvatar = function(url) {
        var preview = document.getElementById('avatarPreview');
        var input = document.getElementById('avatarInput');
        if (preview) preview.src = url;
        if (input) input.value = url;
    };

    window.handleAvatarUpload = function(event) {
        var file = event.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(e) {
            var preview = document.getElementById('avatarPreview');
            var input = document.getElementById('avatarInput');
            if (preview) preview.src = e.target.result;
            if (input) input.value = e.target.result;
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    // ============ FILE ATTACHMENT HELPERS ============
    window.handleFileAttachment = function(event) {
        var files = event.target.files;
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            var reader = new FileReader();
            reader.onload = function(f) {
                return function(e) {
                    tempFiles.push({ name: f.name, data: e.target.result, type: f.type });
                    renderTempFiles();
                };
            }(f);
            reader.readAsDataURL(f);
        }
        event.target.value = '';
    };

    window.removeTempFile = function(index) {
        tempFiles.splice(index, 1);
        renderTempFiles();
    };

    function renderTempFiles() {
        var container = document.getElementById('tempFilesContainer');
        if (!container) return;
        if (!tempFiles.length) {
            container.innerHTML = '<span style="color:var(--text-secondary);font-size:13px;">No files attached</span>';
            return;
        }
        container.innerHTML = tempFiles.map(function(f, i) {
            return '<span class="modal-file-item">' + escapeHtml(f.name) + ' <button onclick="removeTempFile(' + i + ')" style="background:none;border:none;cursor:pointer;color:var(--danger);"><i class="ti ti-x" style="font-size:16px;"></i></button></span>';
        }).join('');
    }

    // ============ CUSTOM FIELDS ============
    window.addCustomField = function() {
        var container = document.getElementById('customFieldsContainer');
        var div = document.createElement('div');
        div.className = 'form-group custom-field-group';
        div.innerHTML = '<div style="display:flex;gap:8px;align-items:center;"><input type="text" placeholder="Field name" class="custom-field-key" style="flex:1;"><input type="text" placeholder="Value" class="custom-field-value" style="flex:2;"><button type="button" onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;color:var(--danger);cursor:pointer;"><i class="ti ti-trash"></i></button></div>';
        container.appendChild(div);
    };

    // ============ CREATE / EDIT CONTACT ============
    function showCreateForm(contactToEdit) {
        activeView = 'create';
        editingContactId = contactToEdit ? contactToEdit.id : null;
        tempFiles = [];
        setActiveSidebarButton('btnCreateContact');
        var isEdit = !!contactToEdit;
        var title = isEdit ? 'Edit Contact' : 'Create a new contact';
        var icon = isEdit ? 'ti-edit' : 'ti-user-plus';
        var nameVal = isEdit ? escapeHtml(contactToEdit.name) : '';
        var phoneVal = isEdit ? escapeHtml(contactToEdit.phone) : '';
        var emailVal = isEdit ? escapeHtml(contactToEdit.email || '') : '';
        var notesVal = isEdit ? escapeHtml(contactToEdit.notes || '') : '';
        var locationVal = isEdit ? escapeHtml(contactToEdit.location || '') : '';
        var birthdayVal = isEdit ? escapeHtml(contactToEdit.birthday || '') : '';
        var currentAvatar = contactToEdit ? contactToEdit.avatar || DEFAULT_AVATAR : DEFAULT_AVATAR;
        var tagsVal = isEdit && contactToEdit.tags ? contactToEdit.tags.join(', ') : '';

        var customFieldsHtml = '';
        if (isEdit && contactToEdit.customFields) {
            for (var key in contactToEdit.customFields) {
                if (contactToEdit.customFields.hasOwnProperty(key) && contactToEdit.customFields[key]) {
                    customFieldsHtml += '<div class="form-group custom-field-group"><div style="display:flex;gap:8px;align-items:center;"><input type="text" placeholder="Field name" class="custom-field-key" value="' + escapeHtml(key) + '" style="flex:1;"><input type="text" placeholder="Value" class="custom-field-value" value="' + escapeHtml(contactToEdit.customFields[key]) + '" style="flex:2;"><button type="button" onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;color:var(--danger);cursor:pointer;"><i class="ti ti-trash"></i></button></div></div>';
                }
            }
        }

        var filesHtml = '';
        if (isEdit && contactToEdit.files) {
            tempFiles = JSON.parse(JSON.stringify(contactToEdit.files));
            filesHtml = tempFiles.map(function(f) {
                return '<span class="modal-file-item">' + escapeHtml(f.name) + '</span>';
            }).join('');
        }

        var content = '<div class="form-container">' +
            '<h3><i class="ti ' + icon + '"></i> ' + title + '</h3>' +
            '<form id="contactForm" onsubmit="return false;">' +
            '<div class="form-group text-center">' +
            '<img id="avatarPreview" class="avatar-preview" src="' + escapeHtml(currentAvatar) + '" onerror="this.src=\'' + DEFAULT_AVATAR + '\'">' +
            '<input type="hidden" id="avatarInput" value="' + escapeHtml(currentAvatar) + '">' +
            '<div class="avatar-options">' + AVATAR_OPTIONS.map(function(u) { return '<img class="avatar-option" src="' + u + '" onclick="selectAvatar(\'' + u + '\')" onerror="this.style.display=\'none\'">'; }).join('') + '</div>' +
            '<label for="avatarUpload" class="btn-cancel" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:8px 16px;font-size:13px;"><i class="ti ti-upload"></i> Upload from computer</label>' +
            '<input type="file" id="avatarUpload" accept="image/*" style="display:none" onchange="handleAvatarUpload(event)">' +
            '</div>' +
            '<div class="form-group"><label><i class="ti ti-user"></i> Full Name *</label><input type="text" id="contactName" value="' + nameVal + '" required></div>' +
            '<div class="form-group"><label><i class="ti ti-phone"></i> Phone Number *</label><input type="tel" id="contactPhone" value="' + phoneVal + '" required></div>' +
            '<div class="form-group"><label><i class="ti ti-mail"></i> Email</label><input type="email" id="contactEmail" value="' + emailVal + '"></div>' +
            '<div class="form-group"><label><i class="ti ti-cake"></i> Birthday</label><input type="date" id="contactBirthday" value="' + birthdayVal + '"></div>' +
            '<div class="form-group"><label><i class="ti ti-tags"></i> Tags (comma separated)</label><input type="text" id="contactTags" placeholder="e.g. work, family, friends" value="' + tagsVal + '"></div>' +
            '<div class="form-group"><label><i class="ti ti-map-pin"></i> Location (lat, lng)</label><input type="text" id="contactLocation" placeholder="e.g. 24.7136,46.6753" value="' + locationVal + '"></div>' +
            '<div class="form-group"><label><i class="ti ti-notes"></i> Notes</label><textarea id="contactNotes">' + notesVal + '</textarea></div>' +
            '<div class="form-group"><label><i class="ti ti-tag"></i> Custom Fields</label><div id="customFieldsContainer">' + customFieldsHtml + '</div><button type="button" class="btn-sm" onclick="addCustomField()" style="margin-top:8px;"><i class="ti ti-plus"></i> Add Field</button></div>' +
            '<div class="form-group"><label><i class="ti ti-paperclip"></i> Attachments</label><input type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" onchange="handleFileAttachment(event)" style="margin-bottom:8px;"><div id="tempFilesContainer">' + (filesHtml || '<span style="color:var(--text-secondary);font-size:13px;">No files attached</span>') + '</div></div>' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><button type="button" class="btn-submit" id="submitContactBtn"><i class="ti ' + (isEdit ? 'ti-device-floppy' : 'ti-plus') + '"></i> ' + (isEdit ? 'Save Changes' : 'Add Contact') + '</button><button type="button" class="btn-cancel" onclick="showContactsList()"><i class="ti ti-x"></i> Cancel</button></div>' +
            '</form></div>';

        document.getElementById('contentArea').innerHTML = content;
        document.getElementById('submitContactBtn').addEventListener('click', handleContactSubmit);
        document.getElementById('contactForm').addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); handleContactSubmit(); } });
        
        if (isEdit && contactToEdit.files) {
            renderTempFiles();
        }
    }

    function handleContactSubmit() {
        var name = document.getElementById('contactName').value.trim();
        var phone = document.getElementById('contactPhone').value.trim();
        var email = document.getElementById('contactEmail').value.trim();
        var notes = document.getElementById('contactNotes').value.trim();
        var location = document.getElementById('contactLocation').value.trim();
        var birthday = document.getElementById('contactBirthday').value.trim();
        var tagsInput = document.getElementById('contactTags').value.trim();
        var avatar = document.getElementById('avatarInput').value;
        var tags = tagsInput ? tagsInput.split(',').map(function(t) { return t.trim(); }).filter(Boolean) : [];

        var customFields = {};
        var fieldKeys = document.querySelectorAll('.custom-field-key');
        var fieldValues = document.querySelectorAll('.custom-field-value');
        for (var i = 0; i < fieldKeys.length; i++) {
            var key = fieldKeys[i].value.trim();
            var value = fieldValues[i].value.trim();
            if (key && value) customFields[key] = value;
        }

        if (!name || !phone) { showToast('Full Name and Phone Number are required.'); return; }
        if (email && !validateEmail(email)) { showToast('Invalid email address.'); return; }

        var files = tempFiles;

        if (editingContactId) {
            var idx = contacts.findIndex(function(c) { return c.id === editingContactId; });
            if (idx >= 0) {
                contacts[idx] = {
                    id: contacts[idx].id,
                    name: sanitizeText(name),
                    phone: sanitizeText(phone),
                    email: sanitizeText(email),
                    notes: sanitizeText(notes),
                    location: sanitizeText(location),
                    avatar: avatar,
                    birthday: birthday,
                    tags: tags,
                    customFields: customFields,
                    files: files,
                    createdAt: contacts[idx].createdAt || new Date().toISOString(),
                    favorite: contacts[idx].favorite || false
                };
                showToast('Contact updated.');
            }
            editingContactId = null;
        } else {
            contacts.push({
                id: generateId(),
                name: sanitizeText(name),
                phone: sanitizeText(phone),
                email: sanitizeText(email),
                notes: sanitizeText(notes),
                location: sanitizeText(location),
                avatar: avatar,
                birthday: birthday,
                tags: tags,
                customFields: customFields,
                files: files,
                createdAt: new Date().toISOString(),
                favorite: false
            });
            showToast('Contact added.');
        }
        tempFiles = [];
        saveContacts();
        updateBadge();
        showContactsList();
    }

    // ============ CONTACTS LIST ============
    function showContactsList() {
        activeView = 'contacts';
        editingContactId = null;
        setActiveSidebarButton('btnContacts');
        updateBadge();

        var filtered = contacts.slice();

        if (searchQuery.trim()) {
            var q = searchQuery.trim().toLowerCase();
            filtered = filtered.filter(function(c) {
                return c.name.toLowerCase().indexOf(q) !== -1 ||
                    c.phone.indexOf(q) !== -1 ||
                    (c.email && c.email.toLowerCase().indexOf(q) !== -1) ||
                    (c.notes && c.notes.toLowerCase().indexOf(q) !== -1) ||
                    (c.tags && c.tags.some(function(t) { return t.toLowerCase().indexOf(q) !== -1; }));
            });
        }

        if (currentFilter !== 'all') {
            var group = groups.find(function(g) { return g.id === currentFilter; });
            if (group) {
                filtered = filtered.filter(function(c) { return group.memberIds.indexOf(c.id) !== -1; });
            }
        }

        switch (currentSort) {
            case 'name': filtered.sort(function(a, b) { return a.name.localeCompare(b.name); }); break;
            case 'date': filtered.sort(function(a, b) { return (a.createdAt || '').localeCompare(b.createdAt || ''); }); break;
            case 'phone': filtered.sort(function(a, b) { return a.phone.localeCompare(b.phone); }); break;
            case 'email': filtered.sort(function(a, b) { return (a.email || '').localeCompare(b.email || ''); }); break;
        }

        var favs = filtered.filter(function(c) { return c.favorite; });
        var nonFavs = filtered.filter(function(c) { return !c.favorite; });
        filtered = favs.concat(nonFavs);

        var groupOptions = groups.map(function(g) { return '<option value="' + g.id + '">' + escapeHtml(g.name) + '</option>'; }).join('');

        if (!contacts.length) {
            document.getElementById('contentArea').innerHTML =
                '<div class="section-title"><i class="ti ti-address-book"></i> Contacts</div>' +
                '<div class="filter-bar"><input type="text" placeholder="Search contacts..." id="searchInput" oninput="updateSearch(this.value)"><select id="groupFilter" onchange="updateGroupFilter(this.value)"><option value="all">All Contacts</option>' + groupOptions + '</select><select id="sortSelect" onchange="updateSort(this.value)"><option value="name">Sort by Name</option><option value="date">Sort by Date Added</option><option value="phone">Sort by Phone</option><option value="email">Sort by Email</option></select></div>' +
                '<div class="empty-state"><img src="https://i.postimg.cc/59snm3N2/telephone.png" class="empty-image"><h3>No contacts yet</h3><p>Click <strong>Create a new contact</strong> to add your first contact.</p></div>';
            return;
        }

        var cardsHtml = filtered.length ? filtered.map(function(c) {
            var tagsHtml = (c.tags || []).map(function(t) { return '<span class="tag-badge">' + escapeHtml(t) + '</span>'; }).join(' ');
            return '<div class="contact-card">' +
                '<div class="contact-name"><img src="' + escapeHtml(c.avatar || DEFAULT_AVATAR) + '" class="contact-avatar-small" onerror="this.src=\'' + DEFAULT_AVATAR + '\'">' + escapeHtml(c.name) + (c.favorite ? '<i class="ti ti-star-filled" style="color:#f5a623;font-size:20px;"></i>' : '') + '</div>' +
                '<div class="contact-detail"><i class="ti ti-phone"></i>' + escapeHtml(c.phone) + '</div>' +
                (c.email ? '<div class="contact-detail"><i class="ti ti-mail"></i>' + escapeHtml(c.email) + '</div>' : '') +
                (tagsHtml ? '<div class="contact-detail"><i class="ti ti-tags"></i>' + tagsHtml + '</div>' : '') +
                '<div class="card-actions"><button class="btn-sm ' + (c.favorite ? 'fav-btn active' : 'fav-btn') + '" onclick="toggleFavorite(\'' + c.id + '\')"><i class="ti ' + (c.favorite ? 'ti-star-filled' : 'ti-star') + '"></i></button><button class="btn-sm" onclick="editContact(\'' + c.id + '\')"><i class="ti ti-edit"></i>Edit</button><button class="btn-sm danger" onclick="deleteContact(\'' + c.id + '\')"><i class="ti ti-trash"></i>Delete</button><button class="btn-sm" onclick="openContactModalById(\'' + c.id + '\')"><i class="ti ti-eye"></i>View</button></div></div>';
        }).join('') : '<div class="empty-state"><img src="https://i.postimg.cc/59snm3N2/telephone.png" class="empty-image"><h3>No contacts found</h3><p>Try adjusting your search or filter.</p></div>';

        document.getElementById('contentArea').innerHTML =
            '<div class="section-title"><i class="ti ti-address-book"></i> Contacts (' + contacts.length + ')</div>' +
            '<div class="filter-bar"><input type="text" placeholder="Search contacts..." id="searchInput" value="' + escapeHtml(searchQuery) + '" oninput="updateSearch(this.value)"><select id="groupFilter" onchange="updateGroupFilter(this.value)"><option value="all" ' + (currentFilter === 'all' ? 'selected' : '') + '>All Contacts</option>' + groupOptions + '</select><select id="sortSelect" onchange="updateSort(this.value)"><option value="name" ' + (currentSort === 'name' ? 'selected' : '') + '>Sort by Name</option><option value="date" ' + (currentSort === 'date' ? 'selected' : '') + '>Sort by Date Added</option><option value="phone" ' + (currentSort === 'phone' ? 'selected' : '') + '>Sort by Phone</option><option value="email" ' + (currentSort === 'email' ? 'selected' : '') + '>Sort by Email</option></select></div>' +
            (filtered.length ? '<div class="contacts-grid">' + cardsHtml + '</div>' : cardsHtml);
    }

    window.updateSearch = function(val) { searchQuery = val; showContactsList(); };
    window.updateGroupFilter = function(val) { currentFilter = val; showContactsList(); };
    window.updateSort = function(val) { currentSort = val; showContactsList(); };

    window.toggleFavorite = function(id) {
        var c = getContactById(id);
        if (!c) return;
        c.favorite = !c.favorite;
        saveContacts();
        showContactsList();
        showToast(c.favorite ? 'Added to favorites' : 'Removed from favorites');
    };

    window.openContactModalById = function(id) {
        var contact = getContactById(id);
        if (contact) openContactModal(contact);
    };

    window.editContact = function(id) {
        var c = getContactById(id);
        if (c) showCreateForm(c);
    };

    window.deleteContact = function(id) {
        var c = getContactById(id);
        if (!c) return;
        if (confirm('Delete "' + c.name + '"?')) {
            contacts = contacts.filter(function(x) { return x.id !== id; });
            groups.forEach(function(g) { g.memberIds = g.memberIds.filter(function(mid) { return mid !== id; }); });
            saveContacts();
            saveGroups();
            updateBadge();
            showToast('Contact deleted.');
            if (activeView === 'contacts') showContactsList();
            else if (activeView === 'groups') showGroupsView();
        }
    };

    // ============ GROUPS ============
    function showGroupsView() {
        activeView = 'groups';
        editingGroupId = null;
        setActiveSidebarButton('btnGroups');
        updateBadge();

        if (!contacts.length) {
            document.getElementById('contentArea').innerHTML =
                '<div class="section-title"><i class="ti ti-users"></i> Groups</div>' +
                '<div class="empty-state"><img src="https://i.postimg.cc/fRD7nSbJ/teamwork.png" class="empty-image"><h3>No contacts yet</h3><p>Add contacts first, then create groups.</p></div>';
            return;
        }

        if (!groups.length) {
            document.getElementById('contentArea').innerHTML =
                '<div class="section-title"><i class="ti ti-users"></i> Groups</div>' +
                '<div class="empty-state"><img src="https://i.postimg.cc/fRD7nSbJ/teamwork.png" class="empty-image"><h3>No groups yet</h3><p>Create a new group and add multiple contacts.</p></div>' +
                '<div style="text-align:center;margin-top:16px;"><button class="btn-submit" onclick="showCreateGroupForm()"><i class="ti ti-user-plus"></i> Create New Group</button></div>';
            return;
        }

        var groupsWithMembers = groups.map(function(g) {
            return { id: g.id, name: g.name, memberIds: g.memberIds, members: g.memberIds.map(function(id) { return getContactById(id); }).filter(Boolean) };
        });

        var groupsHtml = groupsWithMembers.map(function(g, i) {
            return '<div class="group-card" id="groupCard-' + g.id + '" data-group-id="' + g.id + '" draggable="true">' +
                '<div class="group-header" onclick="toggleGroupExpand(\'' + g.id + '\')">' +
                '<div><span class="group-name"><i class="ti ti-folder"></i>' + escapeHtml(g.name) + '</span><span class="group-meta">(' + g.members.length + ' members)</span></div>' +
                '<div style="display:flex;gap:8px;" onclick="event.stopPropagation()"><button class="btn-sm" onclick="editGroup(\'' + g.id + '\')"><i class="ti ti-edit"></i>Edit</button><button class="btn-sm danger" onclick="deleteGroup(\'' + g.id + '\')"><i class="ti ti-trash"></i>Delete</button></div></div>' +
                '<div class="group-members-expand">' +
                (g.members.length ? g.members.map(function(m) { return '<span class="group-member-tag"><img src="' + escapeHtml(m.avatar || DEFAULT_AVATAR) + '" class="group-avatar-tiny" onerror="this.src=\'' + DEFAULT_AVATAR + '\'">' + escapeHtml(m.name) + '</span>'; }).join('') : '<span style="color:var(--text-secondary)">No members</span>') +
                '</div></div>';
        }).join('');

        document.getElementById('contentArea').innerHTML =
            '<div class="section-title"><i class="ti ti-users"></i> Groups (' + groups.length + ')</div>' +
            '<div style="margin-bottom:16px;"><button class="btn-submit" onclick="showCreateGroupForm()"><i class="ti ti-user-plus"></i> Create New Group</button></div>' +
            '<div class="groups-list" id="groupsList">' + groupsHtml + '</div>';

        initGroupDragDrop();
    }

    function initGroupDragDrop() {
        var cards = document.querySelectorAll('.group-card');
        var dragged = null;
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            card.addEventListener('dragstart', function(e) {
                dragged = this;
                this.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
            });
            card.addEventListener('dragend', function() {
                this.style.opacity = '1';
                var allCards = document.querySelectorAll('.group-card');
                for (var c = 0; c < allCards.length; c++) {
                    allCards[c].style.borderStyle = 'solid';
                }
            });
            card.addEventListener('dragover', function(e) {
                e.preventDefault();
                this.style.borderStyle = 'dashed';
                this.style.borderColor = 'var(--accent)';
            });
            card.addEventListener('dragleave', function() {
                this.style.borderStyle = 'solid';
                this.style.borderColor = 'var(--border-color)';
            });
            card.addEventListener('drop', function(e) {
                e.preventDefault();
                this.style.borderStyle = 'solid';
                this.style.borderColor = 'var(--border-color)';
                if (dragged && dragged !== this) {
                    var parent = this.parentNode;
                    var children = Array.from(parent.children);
                    var draggedIndex = children.indexOf(dragged);
                    var targetIndex = children.indexOf(this);
                    if (draggedIndex < targetIndex) {
                        parent.insertBefore(dragged, this.nextSibling);
                    } else {
                        parent.insertBefore(dragged, this);
                    }
                    var groupIds = Array.from(parent.children).map(function(el) { return el.dataset.groupId; });
                    groups = groupIds.map(function(id) { return groups.find(function(g) { return g.id === id; }); }).filter(Boolean);
                    saveGroups();
                    showToast('Groups reordered');
                }
                var allCards = document.querySelectorAll('.group-card');
                for (var c = 0; c < allCards.length; c++) {
                    allCards[c].style.borderStyle = 'solid';
                }
            });
        }
    }

    window.toggleGroupExpand = function(id) {
        var el = document.getElementById('groupCard-' + id);
        if (el) el.classList.toggle('expanded');
    };

    function showCreateGroupForm(groupToEdit) {
        if (!contacts.length) { showToast('Add contacts first.'); return; }
        editingGroupId = groupToEdit ? groupToEdit.id : null;
        var isEdit = !!groupToEdit;
        var nameVal = isEdit ? escapeHtml(groupToEdit.name) : '';
        var selectedIds = isEdit ? groupToEdit.memberIds : [];

        var checkboxes = contacts.map(function(c) {
            return '<label><input type="checkbox" value="' + c.id + '" ' + (selectedIds.indexOf(c.id) !== -1 ? 'checked' : '') + '><img src="' + escapeHtml(c.avatar || DEFAULT_AVATAR) + '" class="group-avatar-tiny">' + escapeHtml(c.name) + ' — ' + escapeHtml(c.phone) + '</label>';
        }).join('');

        document.getElementById('contentArea').innerHTML =
            '<div class="form-container"><h3><i class="ti ' + (isEdit ? 'ti-edit' : 'ti-user-plus') + '"></i>' + (isEdit ? 'Edit Group' : 'Create New Group') + '</h3>' +
            '<form id="groupForm"><div class="form-group"><label><i class="ti ti-folder"></i>Group Name *</label><input type="text" id="groupName" value="' + nameVal + '" required></div>' +
            '<div class="form-group"><label><i class="ti ti-users"></i>Select contacts</label><div class="checkbox-list">' + checkboxes + '</div></div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;"><button type="button" class="btn-submit" id="submitGroupBtn"><i class="ti ' + (isEdit ? 'ti-device-floppy' : 'ti-plus') + '"></i>' + (isEdit ? 'Save Changes' : 'Create Group') + '</button><button type="button" class="btn-cancel" onclick="showGroupsView()"><i class="ti ti-x"></i>Cancel</button></div></form></div>';

        document.getElementById('submitGroupBtn').addEventListener('click', handleGroupSubmit);
    }

    function handleGroupSubmit() {
        var name = document.getElementById('groupName').value.trim();
        if (!name) { showToast('Group name required.'); return; }
        var ids = Array.from(document.querySelectorAll('.checkbox-list input:checked')).map(function(cb) { return cb.value; });
        if (!ids.length) { showToast('Select at least one contact.'); return; }

        if (editingGroupId) {
            var idx = groups.findIndex(function(g) { return g.id === editingGroupId; });
            if (idx >= 0) {
                groups[idx].name = sanitizeText(name);
                groups[idx].memberIds = ids;
                showToast('Group updated.');
            }
            editingGroupId = null;
        } else {
            groups.push({ id: generateId(), name: sanitizeText(name), memberIds: ids, createdAt: new Date().toISOString() });
            showToast('Group created.');
        }
        saveGroups();
        showGroupsView();
    }

    window.editGroup = function(id) {
        var g = groups.find(function(x) { return x.id === id; });
        if (g) showCreateGroupForm(g);
    };

    window.deleteGroup = function(id) {
        var g = groups.find(function(x) { return x.id === id; });
        if (!g) return;
        if (confirm('Delete group "' + g.name + '"?')) {
            groups = groups.filter(function(x) { return x.id !== id; });
            saveGroups();
            showToast('Group deleted.');
            if (activeView === 'groups') showGroupsView();
        }
    };

    // ============ STATISTICS ============
    function showStats() {
        activeView = 'stats';
        setActiveSidebarButton('btnStats');

        var totalContacts = contacts.length;
        var totalGroups = groups.length;
        var favorites = contacts.filter(function(c) { return c.favorite; }).length;

        var tagCounts = {};
        contacts.forEach(function(c) {
            if (c.tags) {
                c.tags.forEach(function(t) {
                    tagCounts[t] = (tagCounts[t] || 0) + 1;
                });
            }
        });
        var tagLabels = Object.keys(tagCounts);
        var tagData = Object.values(tagCounts);

        var today = new Date();
        var upcomingBirthdays = contacts.filter(function(c) {
            if (!c.birthday) return false;
            var bd = new Date(c.birthday);
            var nextBd = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
            if (nextBd < today) nextBd.setFullYear(nextBd.getFullYear() + 1);
            var diff = (nextBd - today) / (1000 * 60 * 60 * 24);
            return diff >= 0 && diff <= 30;
        }).sort(function(a, b) {
            var bdA = new Date(a.birthday);
            var bdB = new Date(b.birthday);
            var nextA = new Date(today.getFullYear(), bdA.getMonth(), bdA.getDate());
            if (nextA < today) nextA.setFullYear(nextA.getFullYear() + 1);
            var nextB = new Date(today.getFullYear(), bdB.getMonth(), bdB.getDate());
            if (nextB < today) nextB.setFullYear(nextB.getFullYear() + 1);
            return nextA - nextB;
        });

        var birthdayHtml = '';
        if (upcomingBirthdays.length) {
            birthdayHtml = '<div class="birthday-reminder"><i class="ti ti-cake"></i> <strong>Upcoming Birthdays (' + upcomingBirthdays.length + '):</strong> ' + upcomingBirthdays.map(function(c) {
                var bd = new Date(c.birthday);
                var nextBd = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
                if (nextBd < today) nextBd.setFullYear(nextBd.getFullYear() + 1);
                var days = Math.ceil((nextBd - today) / (1000 * 60 * 60 * 24));
                return escapeHtml(c.name) + ' (' + days + ' days)';
            }).join(', ') + '</div>';
        }

        var content = '<div class="section-title"><i class="ti ti-chart-bar"></i> Statistics</div>' +
            birthdayHtml +
            '<div class="stats-grid">' +
            '<div class="stat-card"><h4>' + totalContacts + '</h4><p>Total Contacts</p></div>' +
            '<div class="stat-card"><h4>' + totalGroups + '</h4><p>Total Groups</p></div>' +
            '<div class="stat-card"><h4>' + favorites + '</h4><p>Favorites</p></div>' +
            '<div class="stat-card"><h4>' + Object.keys(tagCounts).length + '</h4><p>Unique Tags</p></div>' +
            '</div>';

        if (tagLabels.length) {
            content += '<div class="chart-container"><canvas id="tagChart"></canvas></div>';
        } else {
            content += '<p style="text-align:center;color:var(--text-secondary);font-family:Ubuntu Sans,sans-serif;font-weight:100;">No tags to display</p>';
        }

        content += '<div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">' +
            '<button class="btn-submit" onclick="showContactsList()"><i class="ti ti-address-book"></i> View Contacts</button>' +
            '<button class="btn-cancel" onclick="showGroupsView()"><i class="ti ti-users"></i> View Groups</button>' +
            '</div>';

        document.getElementById('contentArea').innerHTML = content;

        if (tagLabels.length) {
            setTimeout(function() {
                var ctx = document.getElementById('tagChart');
                if (!ctx) return;
                if (chartInstance) chartInstance.destroy();
                chartInstance = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: tagLabels,
                        datasets: [{
                            data: tagData,
                            backgroundColor: ['#1a73e8', '#34a853', '#fbbc04', '#ea4335', '#9c27b0', '#00bcd4'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'bottom' },
                            title: { display: true, text: 'Tags Distribution' }
                        }
                    }
                });
            }, 100);
        }
    }

    // ============ EXPOSE GLOBAL FUNCTIONS ============
    window.showCreateForm = showCreateForm;
    window.showContactsList = showContactsList;
    window.showGroupsView = showGroupsView;
    window.showCreateGroupForm = showCreateGroupForm;
    window.showStats = showStats;

    // ============ INIT ============
    loadData();
    updateBadge();
    showCreateForm();
    console.log('Restudio Contacts initialized successfully');

})();
