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

function sanitizeEmail(email) {
    if (!email || typeof email !== 'string') return '';
    return sanitizeText(email.trim());
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateContactData(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid contact data');
    }
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        throw new Error('Name is required');
    }
    if (!data.phone || typeof data.phone !== 'string' || data.phone.trim().length === 0) {
        throw new Error('Phone is required');
    }
    if (data.email && !isValidEmail(data.email)) {
        throw new Error('Invalid email format');
    }
    if (data.tags && Array.isArray(data.tags)) {
        for (var i = 0; i < data.tags.length; i++) {
            if (typeof data.tags[i] === 'string') {
                if (!isValidText(data.tags[i])) {
                    throw new Error('Suspicious content in tags');
                }
                data.tags[i] = sanitizeText(data.tags[i]);
            }
        }
    }
    if (data.customFields && typeof data.customFields === 'object') {
        for (var key in data.customFields) {
            if (data.customFields.hasOwnProperty(key)) {
                var val = data.customFields[key];
                if (typeof val === 'string') {
                    if (!isValidText(val)) {
                        throw new Error('Suspicious content in custom field: ' + key);
                    }
                    data.customFields[key] = sanitizeText(val);
                }
            }
        }
    }
    return true;
}

function validateFile(file) {
    if (!file) return false;
    var MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
        throw new Error('File too large: ' + (file.size / 1024 / 1024).toFixed(2) + 'MB (max 5MB)');
    }
    var allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.indexOf(file.type) === -1) {
        throw new Error('Unsupported file type: ' + file.type);
    }
    return true;
}

function validateGroupData(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid group data');
    }
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        throw new Error('Group name is required');
    }
    if (!isValidText(data.name)) {
        throw new Error('Suspicious content in group name');
    }
    data.name = sanitizeText(data.name);
    return true;
}

function validateCoordinates(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    if (isNaN(lat) || isNaN(lng)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lng < -180 || lng > 180) return false;
    return true;
}

// ========== MAIN APPLICATION ==========

(function() {
    'use strict';

    var STORAGE_KEY_CONTACTS = 'swrh_contacts_v8';
    var STORAGE_KEY_GROUPS = 'swrh_groups_v8';
    var STORAGE_KEY_SETTINGS = 'swrh_contacts_settings';
    var DEFAULT_AVATAR = 'https://i.postimg.cc/kXcs5vzW/lqtt-shasht-2026-05-23-011056.png';
    var AVATAR_OPTIONS = [
        DEFAULT_AVATAR,
        'https://i.postimg.cc/YqnFVnJ0/glyphs-1779945208550.png',
        'https://i.postimg.cc/xdHbX0qk/shapes-1779945226820.png',
        'https://i.postimg.cc/mDs1M0FX/stripes-1779945220694.png',
        'https://i.postimg.cc/8ckFXM4p/initial-face-1779945199040.png'
    ];

    var contacts = [];
    var groups = [];
    var activeView = 'create';
    var editingContactId = null;
    var editingGroupId = null;
    var filteredContacts = [];
    var searchQuery = '';
    var currentFilterGroup = 'all';
    var currentFilterTag = 'all';
    var currentSort = 'name';
    var customFieldsDefinitions = [];

    function loadData() {
        try {
            var storedContacts = localStorage.getItem(STORAGE_KEY_CONTACTS);
            var storedGroups = localStorage.getItem(STORAGE_KEY_GROUPS);
            var storedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
            contacts = storedContacts ? JSON.parse(storedContacts) : [];
            groups = storedGroups ? JSON.parse(storedGroups) : [];
            if (storedSettings) {
                var settings = JSON.parse(storedSettings);
                customFieldsDefinitions = settings.customFields || [];
            }
            // Ensure each contact has customFields and files arrays
            for (var i = 0; i < contacts.length; i++) {
                if (!contacts[i].customFields) contacts[i].customFields = {};
                if (!contacts[i].files) contacts[i].files = [];
                if (contacts[i].favorite === undefined) contacts[i].favorite = false;
                if (!contacts[i].tags) contacts[i].tags = [];
                if (!contacts[i].birthday) contacts[i].birthday = '';
            }
            console.log('Data loaded', { contacts: contacts.length, groups: groups.length });
        } catch (err) {
            console.error('Error loading data:', err);
            contacts = [];
            groups = [];
        }
    }

    function saveContacts() {
        try {
            localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts));
            console.log('Contacts saved');
        } catch (err) {
            console.error('Error saving contacts:', err);
        }
    }

    function saveGroups() {
        try {
            localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(groups));
            console.log('Groups saved');
        } catch (err) {
            console.error('Error saving groups:', err);
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({
                customFields: customFieldsDefinitions
            }));
        } catch (err) {
            console.error('Error saving settings:', err);
        }
    }

    function generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    function getContactById(id) {
        for (var i = 0; i < contacts.length; i++) {
            if (contacts[i].id === id) return contacts[i];
        }
        return null;
    }

    function updateBadge() {
        var b = document.getElementById('contactCountBadge');
        if (b) b.textContent = contacts.length;
    }

    function setActiveSidebarButton(id) {
        var btns = document.querySelectorAll('.sidebar .btn-sidebar');
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.remove('active');
        }
        var target = document.getElementById(id);
        if (target) target.classList.add('active');
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

    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            var d = new Date(dateStr);
            return d.toLocaleDateString();
        } catch (e) {
            return dateStr;
        }
    }

    function daysUntilBirthday(birthdayStr) {
        if (!birthdayStr) return null;
        try {
            var parts = birthdayStr.split('-');
            if (parts.length !== 3) return null;
            var birthMonth = parseInt(parts[1]);
            var birthDay = parseInt(parts[2]);
            var now = new Date();
            var currentYear = now.getFullYear();
            var targetDate = new Date(currentYear, birthMonth - 1, birthDay);
            if (targetDate < now) {
                targetDate = new Date(currentYear + 1, birthMonth - 1, birthDay);
            }
            var diff = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));
            return diff;
        } catch (e) {
            return null;
        }
    }

    // ============ SORTING ============
    function sortContacts(list, sortBy) {
        var sorted = list.slice();
        switch (sortBy) {
            case 'name':
                sorted.sort(function(a, b) { return a.name.localeCompare(b.name); });
                break;
            case 'nameDesc':
                sorted.sort(function(a, b) { return b.name.localeCompare(a.name); });
                break;
            case 'dateAdded':
                sorted.sort(function(a, b) {
                    var da = a.createdAt || '0';
                    var db = b.createdAt || '0';
                    return da.localeCompare(db);
                });
                break;
            case 'dateAddedDesc':
                sorted.sort(function(a, b) {
                    var da = a.createdAt || '0';
                    var db = b.createdAt || '0';
                    return db.localeCompare(da);
                });
                break;
            case 'phone':
                sorted.sort(function(a, b) { return a.phone.localeCompare(b.phone); });
                break;
            case 'email':
                sorted.sort(function(a, b) {
                    var ea = a.email || '';
                    var eb = b.email || '';
                    return ea.localeCompare(eb);
                });
                break;
            default:
                break;
        }
        return sorted;
    }

    // ============ FILTERING ============
    function getFilteredContacts() {
        var result = contacts.slice();
        // Search filter
        if (searchQuery.trim()) {
            var query = searchQuery.trim().toLowerCase();
            result = result.filter(function(c) {
                return c.name.toLowerCase().indexOf(query) !== -1 ||
                    c.phone.toLowerCase().indexOf(query) !== -1 ||
                    (c.email && c.email.toLowerCase().indexOf(query) !== -1) ||
                    (c.notes && c.notes.toLowerCase().indexOf(query) !== -1) ||
                    (c.tags && c.tags.some(function(t) { return t.toLowerCase().indexOf(query) !== -1; }));
            });
        }
        // Group filter
        if (currentFilterGroup !== 'all') {
            var group = null;
            for (var i = 0; i < groups.length; i++) {
                if (groups[i].id === currentFilterGroup) {
                    group = groups[i];
                    break;
                }
            }
            if (group) {
                result = result.filter(function(c) {
                    return group.memberIds.indexOf(c.id) !== -1;
                });
            }
        }
        // Tag filter
        if (currentFilterTag !== 'all') {
            result = result.filter(function(c) {
                return c.tags && c.tags.indexOf(currentFilterTag) !== -1;
            });
        }
        // Favorites filter (for favorites view)
        if (activeView === 'favorites') {
            result = result.filter(function(c) { return c.favorite === true; });
        }
        return sortContacts(result, currentSort);
    }

    function getAllTags() {
        var tagSet = {};
        for (var i = 0; i < contacts.length; i++) {
            if (contacts[i].tags) {
                for (var j = 0; j < contacts[i].tags.length; j++) {
                    tagSet[contacts[i].tags[j]] = true;
                }
            }
        }
        return Object.keys(tagSet).sort();
    }

    // ============ CLEAR ALL DATA ============
    window.clearAllData = function() {
        if (confirm('Warning: This will delete ALL contacts and groups permanently. Are you sure?')) {
            localStorage.removeItem(STORAGE_KEY_CONTACTS);
            localStorage.removeItem(STORAGE_KEY_GROUPS);
            localStorage.removeItem(STORAGE_KEY_SETTINGS);
            contacts = [];
            groups = [];
            customFieldsDefinitions = [];
            updateBadge();
            showToast('All data cleared successfully.');
            if (activeView === 'contacts') showContactsList();
            else if (activeView === 'groups') showGroupsView();
            else if (activeView === 'favorites') showFavorites();
            else if (activeView === 'dashboard') showDashboard();
            else showCreateForm();
        }
    };

    // ============ DASHBOARD ============
    function showDashboard() {
        activeView = 'dashboard';
        setActiveSidebarButton('btnDashboardSidebar');
        updateBadge();

        var totalContacts = contacts.length;
        var totalGroups = groups.length;
        var totalFavorites = contacts.filter(function(c) { return c.favorite; }).length;
        var totalTags = getAllTags().length;

        // Upcoming birthdays
        var birthdayItems = [];
        for (var i = 0; i < contacts.length; i++) {
            var c = contacts[i];
            if (c.birthday) {
                var days = daysUntilBirthday(c.birthday);
                if (days !== null && days >= 0 && days <= 30) {
                    birthdayItems.push({ contact: c, days: days });
                }
            }
        }
        birthdayItems.sort(function(a, b) { return a.days - b.days; });

        var birthdayHtml = '';
        if (birthdayItems.length > 0) {
            birthdayHtml = '<div class="upcoming-birthdays"><h4><i class="ti ti-cake"></i> Upcoming Birthdays</h4>';
            for (var j = 0; j < birthdayItems.length; j++) {
                var item = birthdayItems[j];
                var urgentClass = item.days <= 3 ? 'urgent' : '';
                birthdayHtml += '<div class="birthday-item"><img src="' + escapeHtml(item.contact.avatar || DEFAULT_AVATAR) + '" class="contact-avatar-small"><span>' + escapeHtml(item.contact.name) + '</span><span class="days-left ' + urgentClass + '">' + item.days + ' days</span></div>';
            }
            birthdayHtml += '</div>';
        }

        var tags = getAllTags();
        var tagsHtml = '';
        if (tags.length > 0) {
            tagsHtml = '<div style="margin-top:16px;"><h4><i class="ti ti-tags"></i> All Tags</h4><div class="tags-cloud">';
            for (var k = 0; k < tags.length; k++) {
                tagsHtml += '<span class="tag-cloud-item" onclick="filterByTag(\'' + escapeHtml(tags[k]) + '\')">' + escapeHtml(tags[k]) + '</span>';
            }
            tagsHtml += '</div></div>';
        }

        var html = '<div class="section-title"><i class="ti ti-dashboard"></i> Dashboard</div>' +
            '<div class="dashboard-grid">' +
            '<div class="dashboard-stat"><div class="stat-icon"><i class="ti ti-users"></i></div><div class="stat-number">' + totalContacts + '</div><div class="stat-label">Total Contacts</div></div>' +
            '<div class="dashboard-stat"><div class="stat-icon"><i class="ti ti-folder"></i></div><div class="stat-number">' + totalGroups + '</div><div class="stat-label">Total Groups</div></div>' +
            '<div class="dashboard-stat"><div class="stat-icon"><i class="ti ti-star"></i></div><div class="stat-number">' + totalFavorites + '</div><div class="stat-label">Favorites</div></div>' +
            '<div class="dashboard-stat"><div class="stat-icon"><i class="ti ti-tags"></i></div><div class="stat-number">' + totalTags + '</div><div class="stat-label">Total Tags</div></div>' +
            '</div>' +
            birthdayHtml +
            tagsHtml;

        document.getElementById('contentArea').innerHTML = html;
    }

    window.filterByTag = function(tag) {
        currentFilterTag = tag;
        showContactsList();
    };

    // ============ CONTACT MODAL ============
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

        // Custom fields
        var customHtml = '';
        if (contact.customFields) {
            for (var key in contact.customFields) {
                if (contact.customFields.hasOwnProperty(key) && contact.customFields[key]) {
                    customHtml += '<div class="modal-info-item"><i class="ti ti-edit"></i> <strong>' + escapeHtml(key) + ':</strong> ' + escapeHtml(contact.customFields[key]) + '</div>';
                }
            }
        }

        // Files
        var filesHtml = '';
        if (contact.files && contact.files.length > 0) {
            filesHtml = '<div style="margin-top:8px;"><strong><i class="ti ti-file"></i> Attachments:</strong>';
            for (var f = 0; f < contact.files.length; f++) {
                var file = contact.files[f];
                var isImage = file.type && file.type.startsWith('image/');
                var displayName = file.name || 'Attachment';
                if (isImage) {
                    filesHtml += '<div class="modal-file-item"><i class="ti ti-photo"></i> <a href="' + file.data + '" target="_blank">' + escapeHtml(displayName) + '</a></div>';
                } else {
                    filesHtml += '<div class="modal-file-item"><i class="ti ti-file"></i> <a href="' + file.data + '" target="_blank" download="' + escapeHtml(displayName) + '">' + escapeHtml(displayName) + '</a></div>';
                }
            }
            filesHtml += '</div>';
        }

        var html = '<div class="modal-overlay" id="modalOverlay" onclick="if(event.target===this) closeModal()">' +
            '<div class="modal-dialog" onclick="event.stopPropagation()">' +
            '<button class="modal-close" onclick="closeModal()"><i class="ti ti-x"></i></button>' +
            '<img class="modal-avatar" src="' + escapeHtml(contact.avatar || DEFAULT_AVATAR) + '" onerror="this.src=\'' + DEFAULT_AVATAR + '\'" alt="Avatar">' +
            '<div class="modal-name">' + escapeHtml(contact.name) + (contact.favorite ? ' <i class="ti ti-star" style="color:#fbbc04;"></i>' : '') + '</div>' +
            '<div class="modal-info">' +
            '<div class="modal-info-item"><i class="ti ti-phone"></i> ' + escapeHtml(contact.phone) + '</div>' +
            (hasEmail ? '<div class="modal-info-item"><i class="ti ti-mail"></i> ' + escapeHtml(contact.email) + '</div>' : '') +
            (contact.notes ? '<div class="modal-info-item"><i class="ti ti-notes"></i> ' + escapeHtml(contact.notes) + '</div>' : '') +
            (contact.birthday ? '<div class="modal-info-item"><i class="ti ti-cake"></i> ' + escapeHtml(formatDate(contact.birthday)) + '</div>' : '') +
            (locationStr ? '<div class="modal-info-item"><i class="ti ti-map-pin"></i> ' + escapeHtml(locationStr) + '</div>' : '') +
            (contact.tags && contact.tags.length > 0 ? '<div class="modal-info-item"><i class="ti ti-tags"></i> ' + contact.tags.map(function(t) { return '<span class="tag-badge">' + escapeHtml(t) + '</span>'; }).join(' ') + '</div>' : '') +
            customHtml +
            '</div>' +
            filesHtml +
            mapHtml +
            '<div class="modal-actions">' +
            (hasEmail ? '<a href="mailto:' + escapeHtml(contact.email) + '" class="modal-btn"><i class="ti ti-mail"></i> Mail</a>' : '') +
            '<a href="tel:' + escapeHtml(contact.phone) + '" class="modal-btn"><i class="ti ti-phone"></i> Call</a>' +
            '<button class="modal-btn" onclick="editContact(\'' + contact.id + '\'); closeModal();"><i class="ti ti-edit"></i> Edit</button>' +
            '<button class="modal-btn danger" onclick="deleteContact(\'' + contact.id + '\'); closeModal();"><i class="ti ti-trash"></i> Delete</button>' +
            '</div>' +
            '</div></div>';

        document.getElementById('modalContainer').innerHTML = html;

        if (validCoords) {
            setTimeout(function() {
                var mapEl = document.getElementById('modalMap-' + contact.id);
                if (mapEl && typeof maplibregl !== 'undefined') {
                    try {
                        var map = new maplibregl.Map({
                            container: 'modalMap-' + contact.id,
                            style: {
                                version: 8,
                                sources: {
                                    'osm-tiles': {
                                        type: 'raster',
                                        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                                        tileSize: 256
                                    }
                                },
                                layers: [{ id: 'osm-tiles-layer', type: 'raster', source: 'osm-tiles', minzoom: 0, maxzoom: 19 }]
                            },
                            center: [validCoords.lng, validCoords.lat],
                            zoom: 14,
                            attributionControl: false
                        });
                        new maplibregl.Marker().setLngLat([validCoords.lng, validCoords.lat]).addTo(map);
                    } catch (err) {
                        console.warn('Map error:', err);
                    }
                }
            }, 50);
        }
    }

    window.closeModal = function() {
        document.getElementById('modalContainer').innerHTML = '';
    };

    window.openContactModalById = function(id) {
        var contact = getContactById(id);
        if (contact) openContactModal(contact);
    };

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
        try {
            validateFile(file);
            var reader = new FileReader();
            reader.onload = function(e) {
                var preview = document.getElementById('avatarPreview');
                var input = document.getElementById('avatarInput');
                if (preview) preview.src = e.target.result;
                if (input) input.value = e.target.result;
            };
            reader.readAsDataURL(file);
        } catch (err) {
            showToast('Error: ' + err.message);
        }
        event.target.value = '';
    };

    // ============ FILE ATTACHMENT ============
    window.handleFileAttachment = function(event) {
        var file = event.target.files[0];
        if (!file) return;
        try {
            validateFile(file);
            var reader = new FileReader();
            reader.onload = function(e) {
                var container = document.getElementById('fileAttachmentsContainer');
                if (!container) return;
                var fileEntry = {
                    name: file.name,
                    type: file.type,
                    data: e.target.result,
                    size: file.size,
                    uploadedAt: new Date().toISOString()
                };
                // Store in a hidden array
                if (!window._tempFiles) window._tempFiles = [];
                window._tempFiles.push(fileEntry);
                renderFileAttachments();
            };
            reader.readAsDataURL(file);
        } catch (err) {
            showToast('Error: ' + err.message);
        }
        event.target.value = '';
    };

    function renderFileAttachments() {
        var container = document.getElementById('fileAttachmentsContainer');
        if (!container) return;
        var files = window._tempFiles || [];
        if (files.length === 0) {
            container.innerHTML = '<span style="color:var(--text-secondary);font-size:13px;">No files attached</span>';
            return;
        }
        var html = '';
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            var icon = f.type && f.type.startsWith('image/') ? 'ti-photo' : 'ti-file';
            html += '<div class="file-attachment-item"><i class="ti ' + icon + '"></i> ' + escapeHtml(f.name) + ' <button class="btn-remove-field" onclick="removeTempFile(' + i + ')" style="background:none;border:none;color:var(--danger);cursor:pointer;"><i class="ti ti-x"></i></button></div>';
        }
        container.innerHTML = html;
    }

    window.removeTempFile = function(index) {
        if (window._tempFiles && window._tempFiles[index]) {
            window._tempFiles.splice(index, 1);
            renderFileAttachments();
        }
    };

    // ============ CUSTOM FIELDS ============
    function renderCustomFields() {
        var container = document.getElementById('customFieldsContainer');
        if (!container) return;
        var fields = customFieldsDefinitions;
        var contactCustom = window._contactCustomFields || {};
        if (fields.length === 0) {
            container.innerHTML = '<span style="color:var(--text-secondary);font-size:13px;">No custom fields defined. Add one below.</span>';
            return;
        }
        var html = '';
        for (var i = 0; i < fields.length; i++) {
            var field = fields[i];
            var value = contactCustom[field] || '';
            html += '<div class="custom-field-row"><input type="text" placeholder="' + escapeHtml(field) + '" value="' + escapeHtml(value) + '" data-field-name="' + escapeHtml(field) + '" class="custom-field-input"><span style="font-size:12px;color:var(--text-secondary);">' + escapeHtml(field) + '</span></div>';
        }
        container.innerHTML = html;
        // Attach input listeners
        var inputs = container.querySelectorAll('.custom-field-input');
        for (var j = 0; j < inputs.length; j++) {
            inputs[j].addEventListener('input', function() {
                var name = this.dataset.fieldName;
                if (!window._contactCustomFields) window._contactCustomFields = {};
                window._contactCustomFields[name] = this.value;
            });
        }
    }

    // ============ CREATE / EDIT CONTACT ============
    function showCreateForm(contactToEdit) {
        activeView = 'create';
        editingContactId = contactToEdit ? contactToEdit.id : null;
        setActiveSidebarButton('btnCreateContact');

        var isEdit = !!contactToEdit;
        var title = isEdit ? 'Edit Contact' : 'Create a new contact';
        var icon = isEdit ? 'ti-edit' : 'ti-user-plus';
        var nameVal = isEdit ? escapeHtml(contactToEdit.name) : '';
        var phoneVal = isEdit ? escapeHtml(contactToEdit.phone) : '';
        var emailVal = isEdit ? escapeHtml(contactToEdit.email || '') : '';
        var notesVal = isEdit ? escapeHtml(contactToEdit.notes || '') : '';
        var locationVal = isEdit ? escapeHtml(contactToEdit.location || '') : '';
        var birthdayVal = isEdit ? (contactToEdit.birthday || '') : '';
        var currentAvatar = contactToEdit ? (contactToEdit.avatar || DEFAULT_AVATAR) : DEFAULT_AVATAR;
        var isFavorite = isEdit && contactToEdit.favorite === true;
        var tags = isEdit ? (contactToEdit.tags || []) : [];
        var customFields = isEdit ? (contactToEdit.customFields || {}) : {};

        window._contactCustomFields = customFields;
        window._tempFiles = isEdit ? (contactToEdit.files || []) : [];

        var tagsHtml = tags.map(function(t) {
            return '<span class="tag-badge" style="display:inline-flex;align-items:center;gap:4px;">' + escapeHtml(t) + ' <button onclick="removeTag(this)" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;">×</button></span>';
        }).join('');

        var allTags = getAllTags();
        var tagSuggestions = allTags.filter(function(t) { return tags.indexOf(t) === -1; }).map(function(t) {
            return '<span class="tag-badge" style="cursor:pointer;background:#e8eaed;" onclick="addTag(\'' + escapeHtml(t) + '\')">+ ' + escapeHtml(t) + '</span>';
        }).join('');

        var content = '<div class="form-container">' +
            '<h3><i class="ti ' + icon + '"></i> ' + title + '</h3>' +
            '<form id="contactForm" onsubmit="return false;">' +
            '<div class="form-group text-center">' +
            '<img id="avatarPreview" class="avatar-preview" src="' + escapeHtml(currentAvatar) + '" onerror="this.src=\'' + DEFAULT_AVATAR + '\'">' +
            '<input type="hidden" id="avatarInput" value="' + escapeHtml(currentAvatar) + '">' +
            '<div class="avatar-options">';
        for (var i = 0; i < AVATAR_OPTIONS.length; i++) {
            content += '<img class="avatar-option" src="' + AVATAR_OPTIONS[i] + '" onclick="selectAvatar(\'' + AVATAR_OPTIONS[i] + '\')" onerror="this.style.display=\'none\'">';
        }
        content += '</div>' +
            '<label for="avatarUpload" class="btn-cancel" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:8px 16px;font-size:13px;"><i class="ti ti-upload"></i> Upload from computer</label>' +
            '<input type="file" id="avatarUpload" accept="image/*" style="display:none" onchange="handleAvatarUpload(event)">' +
            '</div>' +
            '<div class="form-group"><label><i class="ti ti-user"></i> Full Name *</label><input type="text" id="contactName" value="' + nameVal + '" required></div>' +
            '<div class="form-group"><label><i class="ti ti-phone"></i> Phone Number *</label><input type="tel" id="contactPhone" value="' + phoneVal + '" required></div>' +
            '<div class="form-group"><label><i class="ti ti-mail"></i> Email</label><input type="email" id="contactEmail" value="' + emailVal + '"></div>' +
            '<div class="form-group"><label><i class="ti ti-map-pin"></i> Location (lat, lng)</label><input type="text" id="contactLocation" placeholder="e.g. 24.7136,46.6753" value="' + locationVal + '"></div>' +
            '<div class="form-group"><label><i class="ti ti-cake"></i> Birthday</label><input type="date" id="contactBirthday" value="' + birthdayVal + '"></div>' +
            '<div class="form-group"><label><i class="ti ti-notes"></i> Notes</label><textarea id="contactNotes">' + notesVal + '</textarea></div>' +
            '<div class="form-group"><label><i class="ti ti-tags"></i> Tags</label><div id="tagsContainer" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">' + tagsHtml + '</div><div style="display:flex;gap:8px;"><input type="text" id="tagInput" placeholder="Add tag..." style="flex:1;"><button type="button" class="btn-sm" onclick="addNewTag()"><i class="ti ti-plus"></i> Add</button></div><div style="margin-top:4px;">' + tagSuggestions + '</div></div>' +
            '<div class="form-group"><label><i class="ti ti-star"></i> Favorite</label><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="contactFavorite" ' + (isFavorite ? 'checked' : '') + '> Mark as favorite</label></div>' +
            '<div class="form-group"><label><i class="ti ti-edit"></i> Custom Fields</label><div id="customFieldsContainer"></div><button type="button" class="btn-sm" onclick="addCustomField()"><i class="ti ti-plus"></i> Add Custom Field</button></div>' +
            '<div class="form-group"><label><i class="ti ti-file"></i> Attachments</label><div id="fileAttachmentsContainer"></div><input type="file" id="fileAttachmentInput" accept="image/*,application/pdf,text/plain,.doc,.docx" style="display:none" multiple><button type="button" class="btn-sm" onclick="document.getElementById(\'fileAttachmentInput\').click()"><i class="ti ti-upload"></i> Upload File</button></div>' +
            '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;">' +
            '<button type="button" class="btn-submit" id="submitContactBtn"><i class="ti ' + (isEdit ? 'ti-device-floppy' : 'ti-plus') + '"></i> ' + (isEdit ? 'Save Changes' : 'Add Contact') + '</button>' +
            '<button type="button" class="btn-cancel" onclick="showContactsList()"><i class="ti ti-x"></i> Cancel</button>' +
            '</div>' +
            '</form></div>';

        document.getElementById('contentArea').innerHTML = content;

        // Render custom fields and files
        renderCustomFields();
        renderFileAttachments();

        document.getElementById('submitContactBtn').addEventListener('click', handleContactSubmit);
        document.getElementById('contactForm').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleContactSubmit();
            }
        });

        document.getElementById('fileAttachmentInput').addEventListener('change', window.handleFileAttachment);

        // Tag input enter key
        document.getElementById('tagInput').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addNewTag();
            }
        });
    }

    window.addNewTag = function() {
        var input = document.getElementById('tagInput');
        if (!input) return;
        var tag = input.value.trim();
        if (!tag) return;
        if (!isValidText(tag)) {
            showToast('Invalid tag content.');
            return;
        }
        var sanitized = sanitizeText(tag);
        var container = document.getElementById('tagsContainer');
        if (!container) return;
        var tagSpan = document.createElement('span');
        tagSpan.className = 'tag-badge';
        tagSpan.style.display = 'inline-flex';
        tagSpan.style.alignItems = 'center';
        tagSpan.style.gap = '4px';
        tagSpan.innerHTML = escapeHtml(sanitized) + ' <button onclick="removeTag(this)" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;">×</button>';
        container.appendChild(tagSpan);
        input.value = '';
        // Update suggestions
        updateTagSuggestions();
    };

    window.removeTag = function(btn) {
        var span = btn.parentElement;
        if (span) span.remove();
        updateTagSuggestions();
    };

    function getCurrentTags() {
        var container = document.getElementById('tagsContainer');
        if (!container) return [];
        var tags = [];
        var items = container.querySelectorAll('.tag-badge');
        for (var i = 0; i < items.length; i++) {
            var text = items[i].textContent.replace('×', '').trim();
            if (text) tags.push(text);
        }
        return tags;
    }

    function updateTagSuggestions() {
        var currentTags = getCurrentTags();
        var allTags = getAllTags();
        var available = allTags.filter(function(t) { return currentTags.indexOf(t) === -1; });
        var container = document.querySelector('.form-group #tagsContainer');
        if (!container) return;
        var parent = container.parentElement;
        var suggestionsDiv = parent.querySelector('div[style*="margin-top:4px;"]');
        if (suggestionsDiv) {
            if (available.length === 0) {
                suggestionsDiv.innerHTML = '';
            } else {
                suggestionsDiv.innerHTML = available.map(function(t) {
                    return '<span class="tag-badge" style="cursor:pointer;background:#e8eaed;" onclick="addTag(\'' + escapeHtml(t) + '\')">+ ' + escapeHtml(t) + '</span>';
                }).join('');
            }
        }
    }

    window.addTag = function(tag) {
        var container = document.getElementById('tagsContainer');
        if (!container) return;
        // Check if already exists
        var existing = container.querySelectorAll('.tag-badge');
        for (var i = 0; i < existing.length; i++) {
            if (existing[i].textContent.replace('×', '').trim() === tag) return;
        }
        var tagSpan = document.createElement('span');
        tagSpan.className = 'tag-badge';
        tagSpan.style.display = 'inline-flex';
        tagSpan.style.alignItems = 'center';
        tagSpan.style.gap = '4px';
        tagSpan.innerHTML = escapeHtml(tag) + ' <button onclick="removeTag(this)" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;">×</button>';
        container.appendChild(tagSpan);
        updateTagSuggestions();
    };

    window.addCustomField = function() {
        var name = prompt('Enter custom field name:');
        if (!name || !name.trim()) return;
        var sanitized = sanitizeText(name.trim());
        if (!isValidText(sanitized)) {
            showToast('Invalid field name.');
            return;
        }
        customFieldsDefinitions.push(sanitized);
        saveSettings();
        renderCustomFields();
        showToast('Custom field added.');
    };

    function handleContactSubmit() {
        var name = document.getElementById('contactName').value.trim();
        var phone = document.getElementById('contactPhone').value.trim();
        var email = document.getElementById('contactEmail').value.trim();
        var notes = document.getElementById('contactNotes').value.trim();
        var location = document.getElementById('contactLocation').value.trim();
        var birthday = document.getElementById('contactBirthday').value;
        var avatar = document.getElementById('avatarInput').value;
        var favorite = document.getElementById('contactFavorite').checked;
        var tags = getCurrentTags();

        if (!name || !phone) {
            showToast('Full Name and Phone Number are required.');
            return;
        }
        if (!isValidText(name)) {
            showToast('Invalid name content.');
            return;
        }
        if (email && !isValidEmail(email)) {
            showToast('Invalid email format.');
            return;
        }

        var customFields = window._contactCustomFields || {};
        var files = window._tempFiles || [];

        if (editingContactId) {
            var idx = -1;
            for (var i = 0; i < contacts.length; i++) {
                if (contacts[i].id === editingContactId) {
                    idx = i;
                    break;
                }
            }
            if (idx >= 0) {
                contacts[idx] = {
                    id: contacts[idx].id,
                    name: sanitizeText(name),
                    phone: sanitizeText(phone),
                    email: email ? sanitizeEmail(email) : '',
                    notes: notes ? sanitizeText(notes) : '',
                    location: location ? sanitizeText(location) : '',
                    birthday: birthday || '',
                    avatar: avatar || DEFAULT_AVATAR,
                    favorite: favorite,
                    tags: tags,
                    customFields: customFields,
                    files: files,
                    createdAt: contacts[idx].createdAt,
                    updatedAt: new Date().toISOString()
                };
                showToast('Contact updated.');
            }
            editingContactId = null;
        } else {
            var newContact = {
                id: generateId(),
                name: sanitizeText(name),
                phone: sanitizeText(phone),
                email: email ? sanitizeEmail(email) : '',
                notes: notes ? sanitizeText(notes) : '',
                location: location ? sanitizeText(location) : '',
                birthday: birthday || '',
                avatar: avatar || DEFAULT_AVATAR,
                favorite: favorite,
                tags: tags,
                customFields: customFields,
                files: files,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            contacts.push(newContact);
            showToast('Contact added.');
        }

        window._tempFiles = [];
        window._contactCustomFields = {};

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

        var filtered = getFilteredContacts();
        var allTags = getAllTags();

        var groupOptions = '<option value="all">All Groups</option>';
        for (var i = 0; i < groups.length; i++) {
            groupOptions += '<option value="' + groups[i].id + '">' + escapeHtml(groups[i].name) + '</option>';
        }

        var tagOptions = '<option value="all">All Tags</option>';
        for (var j = 0; j < allTags.length; j++) {
            tagOptions += '<option value="' + escapeHtml(allTags[j]) + '">' + escapeHtml(allTags[j]) + '</option>';
        }

        var sortOptions =
            '<option value="name">Name (A-Z)</option>' +
            '<option value="nameDesc">Name (Z-A)</option>' +
            '<option value="dateAdded">Date Added (Oldest)</option>' +
            '<option value="dateAddedDesc">Date Added (Newest)</option>' +
            '<option value="phone">Phone</option>' +
            '<option value="email">Email</option>';

        var searchBar = '<div class="search-filter-bar">' +
            '<div class="search-input-wrapper"><i class="ti ti-search"></i><input type="text" id="searchInput" placeholder="Search contacts..." value="' + escapeHtml(searchQuery) + '"></div>' +
            '<select id="groupFilter" class="sort-select">' + groupOptions + '</select>' +
            '<select id="tagFilter" class="sort-select">' + tagOptions + '</select>' +
            '<select id="sortSelect" class="sort-select">' + sortOptions + '</select>' +
            '</div>';

        if (!filtered.length) {
            var emptyMsg = searchQuery || currentFilterGroup !== 'all' || currentFilterTag !== 'all' ?
                'No contacts match your filters.' :
                'No contacts yet. Click "Create a new contact" to add your first contact.';
            document.getElementById('contentArea').innerHTML = '<div class="section-title"><i class="ti ti-users"></i> Contacts</div>' +
                searchBar +
                '<div class="empty-state"><i class="ti ti-users"></i><h3>' + emptyMsg + '</h3></div>';
            attachFilterListeners();
            return;
        }

        var cards = filtered.map(function(c) {
            var stars = '';
            for (var s = 0; s < 5; s++) stars += '☆';
            var tagHtml = c.tags && c.tags.length > 0 ? '<div class="contact-tags">' + c.tags.map(function(t) { return '<span class="tag-badge">' + escapeHtml(t) + '</span>'; }).join('') + '</div>' : '';
            return '<div class="contact-card">' +
                '<div class="contact-name">' +
                '<img src="' + escapeHtml(c.avatar || DEFAULT_AVATAR) + '" class="contact-avatar-small" onerror="this.src=\'' + DEFAULT_AVATAR + '\'">' +
                escapeHtml(c.name) +
                '<button class="favorite-star-btn ' + (c.favorite ? 'active' : '') + '" onclick="toggleFavorite(\'' + c.id + '\')" title="Toggle favorite"><i class="ti ti-star"></i></button>' +
                '</div>' +
                '<div class="contact-detail"><i class="ti ti-phone"></i>' + escapeHtml(c.phone) + '</div>' +
                (c.email ? '<div class="contact-detail"><i class="ti ti-mail"></i>' + escapeHtml(c.email) + '</div>' : '') +
                (c.notes ? '<div class="contact-detail"><i class="ti ti-notes"></i>' + escapeHtml(c.notes) + '</div>' : '') +
                (c.birthday ? '<div class="contact-detail"><i class="ti ti-cake"></i>' + escapeHtml(formatDate(c.birthday)) + '</div>' : '') +
                tagHtml +
                '<div class="card-actions">' +
                '<button class="btn-sm" onclick="editContact(\'' + c.id + '\')"><i class="ti ti-edit"></i>Edit</button>' +
                '<button class="btn-sm danger" onclick="deleteContact(\'' + c.id + '\')"><i class="ti ti-trash"></i>Delete</button>' +
                '<button class="btn-sm" onclick="openContactModalById(\'' + c.id + '\')"><i class="ti ti-eye"></i>View</button>' +
                '</div></div>';
        }).join('');

        document.getElementById('contentArea').innerHTML = '<div class="section-title"><i class="ti ti-users"></i> Contacts (' + filtered.length + ')</div>' +
            searchBar +
            '<div class="contacts-grid">' + cards + '</div>';

        attachFilterListeners();
    }

    function attachFilterListeners() {
        var searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                searchQuery = this.value;
                showContactsList();
            });
        }

        var groupFilter = document.getElementById('groupFilter');
        if (groupFilter) {
            groupFilter.value = currentFilterGroup;
            groupFilter.addEventListener('change', function() {
                currentFilterGroup = this.value;
                showContactsList();
            });
        }

        var tagFilter = document.getElementById('tagFilter');
        if (tagFilter) {
            tagFilter.value = currentFilterTag;
            tagFilter.addEventListener('change', function() {
                currentFilterTag = this.value;
                showContactsList();
            });
        }

        var sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.value = currentSort;
            sortSelect.addEventListener('change', function() {
                currentSort = this.value;
                showContactsList();
            });
        }
    }

    // ============ FAVORITES ============
    function showFavorites() {
        activeView = 'favorites';
        setActiveSidebarButton('btnFavorites');
        updateBadge();

        var filtered = contacts.filter(function(c) { return c.favorite === true; });

        if (!filtered.length) {
            document.getElementById('contentArea').innerHTML = '<div class="section-title"><i class="ti ti-star"></i> Favorites</div>' +
                '<div class="empty-state"><i class="ti ti-star"></i><h3>No favorites yet</h3><p>Star contacts to add them to favorites.</p></div>';
            return;
        }

        var cards = filtered.map(function(c) {
            var tagHtml = c.tags && c.tags.length > 0 ? '<div class="contact-tags">' + c.tags.map(function(t) { return '<span class="tag-badge">' + escapeHtml(t) + '</span>'; }).join('') + '</div>' : '';
            return '<div class="contact-card">' +
                '<div class="contact-name">' +
                '<img src="' + escapeHtml(c.avatar || DEFAULT_AVATAR) + '" class="contact-avatar-small" onerror="this.src=\'' + DEFAULT_AVATAR + '\'">' +
                escapeHtml(c.name) +
                '<button class="favorite-star-btn active" onclick="toggleFavorite(\'' + c.id + '\')" title="Toggle favorite"><i class="ti ti-star"></i></button>' +
                '</div>' +
                '<div class="contact-detail"><i class="ti ti-phone"></i>' + escapeHtml(c.phone) + '</div>' +
                (c.email ? '<div class="contact-detail"><i class="ti ti-mail"></i>' + escapeHtml(c.email) + '</div>' : '') +
                tagHtml +
                '<div class="card-actions">' +
                '<button class="btn-sm" onclick="editContact(\'' + c.id + '\')"><i class="ti ti-edit"></i>Edit</button>' +
                '<button class="btn-sm danger" onclick="deleteContact(\'' + c.id + '\')"><i class="ti ti-trash"></i>Delete</button>' +
                '<button class="btn-sm" onclick="openContactModalById(\'' + c.id + '\')"><i class="ti ti-eye"></i>View</button>' +
                '</div></div>';
        }).join('');

        document.getElementById('contentArea').innerHTML = '<div class="section-title"><i class="ti ti-star"></i> Favorites (' + filtered.length + ')</div>' +
            '<div class="contacts-grid">' + cards + '</div>';
    }

    window.toggleFavorite = function(id) {
        var contact = getContactById(id);
        if (!contact) return;
        contact.favorite = !contact.favorite;
        saveContacts();
        // Refresh current view
        if (activeView === 'contacts') showContactsList();
        else if (activeView === 'favorites') showFavorites();
        else if (activeView === 'dashboard') showDashboard();
    };

    // ============ GROUPS ============
    function showGroupsView() {
        activeView = 'groups';
        editingGroupId = null;
        setActiveSidebarButton('btnGroups');
        updateBadge();

        if (!groups.length) {
            document.getElementById('contentArea').innerHTML = '<div class="section-title"><i class="ti ti-folder"></i> Groups</div>' +
                '<div class="empty-state"><i class="ti ti-folder"></i><h3>No groups yet</h3><p>Create a new group and add multiple contacts.</p></div>' +
                '<div style="text-align:center;margin-top:16px;"><button class="btn-submit" onclick="showCreateGroupForm()"><i class="ti ti-plus"></i> Create New Group</button></div>';
            return;
        }

        var groupsHtml = '';
        for (var i = 0; i < groups.length; i++) {
            var g = groups[i];
            var members = [];
            for (var j = 0; j < g.memberIds.length; j++) {
                var c = getContactById(g.memberIds[j]);
                if (c) members.push(c);
            }
            var membersHtml = members.length ? members.map(function(m) {
                return '<span class="group-member-tag"><img src="' + escapeHtml(m.avatar || DEFAULT_AVATAR) + '" class="group-avatar-tiny" onerror="this.src=\'' + DEFAULT_AVATAR + '\'">' + escapeHtml(m.name) + '</span>';
            }).join('') : '<span style="color:var(--text-secondary)">No members</span>';

            groupsHtml += '<div class="group-card" id="groupCard' + i + '" data-group-id="' + g.id + '">' +
                '<div class="group-header">' +
                '<div><span class="group-name"><i class="ti ti-folder"></i>' + escapeHtml(g.name) + '</span><span class="group-meta">(' + members.length + ' members)</span></div>' +
                '<div style="display:flex;gap:8px;">' +
                '<span class="drag-handle" title="Drag to reorder"><i class="ti ti-grip-vertical"></i></span>' +
                '<button class="btn-sm" onclick="editGroup(\'' + g.id + '\')"><i class="ti ti-edit"></i>Edit</button>' +
                '<button class="btn-sm danger" onclick="deleteGroup(\'' + g.id + '\')"><i class="ti ti-trash"></i>Delete</button>' +
                '</div></div>' +
                '<div class="group-members-expand">' + membersHtml + '</div>' +
                '</div>';
        }

        document.getElementById('contentArea').innerHTML = '<div class="section-title"><i class="ti ti-folder"></i> Groups (' + groups.length + ')</div>' +
            '<div style="margin-bottom:16px;"><button class="btn-submit" onclick="showCreateGroupForm()"><i class="ti ti-plus"></i> Create New Group</button></div>' +
            '<div class="groups-list" id="groupsList">' + groupsHtml + '</div>';

        // Initialize Sortable
        var groupsListEl = document.getElementById('groupsList');
        if (groupsListEl && typeof Sortable !== 'undefined') {
            new Sortable(groupsListEl, {
                handle: '.drag-handle',
                animation: 150,
                onEnd: function(evt) {
                    var item = evt.item;
                    var groupId = item.dataset.groupId;
                    if (!groupId) return;
                    var idx = groups.findIndex(function(g) { return g.id === groupId; });
                    if (idx !== -1) {
                        var moved = groups.splice(idx, 1)[0];
                        groups.splice(evt.newIndex, 0, moved);
                        saveGroups();
                        showToast('Group reordered.');
                    }
                }
            });
        }

        // Expand groups on click
        var cards = document.querySelectorAll('.group-card');
        for (var k = 0; k < cards.length; k++) {
            cards[k].addEventListener('click', function(e) {
                if (!e.target.closest('button')) {
                    this.classList.toggle('expanded');
                }
            });
        }
    }

    function showCreateGroupForm(groupToEdit) {
        if (!contacts.length) {
            showToast('Add contacts first.');
            return;
        }
        editingGroupId = groupToEdit ? groupToEdit.id : null;
        var isEdit = !!groupToEdit;
        var nameVal = isEdit ? escapeHtml(groupToEdit.name) : '';
        var selectedIds = isEdit ? groupToEdit.memberIds : [];

        var checkboxes = contacts.map(function(c) {
            var checked = selectedIds.indexOf(c.id) !== -1 ? 'checked' : '';
            return '<label><input type="checkbox" value="' + c.id + '" ' + checked + '><img src="' + escapeHtml(c.avatar || DEFAULT_AVATAR) + '" class="group-avatar-tiny">' + escapeHtml(c.name) + ' — ' + escapeHtml(c.phone) + '</label>';
        }).join('');

        document.getElementById('contentArea').innerHTML = '<div class="form-container">' +
            '<h3><i class="ti ' + (isEdit ? 'ti-edit' : 'ti-plus') + '"></i>' + (isEdit ? 'Edit Group' : 'Create New Group') + '</h3>' +
            '<form id="groupForm">' +
            '<div class="form-group"><label><i class="ti ti-folder"></i>Group Name *</label><input type="text" id="groupName" value="' + nameVal + '" required></div>' +
            '<div class="form-group"><label><i class="ti ti-users"></i>Select contacts</label><div class="checkbox-list">' + checkboxes + '</div></div>' +
            '<div style="display:flex;gap:8px;"><button type="button" class="btn-submit" id="submitGroupBtn"><i class="ti ' + (isEdit ? 'ti-device-floppy' : 'ti-plus') + '"></i>' + (isEdit ? 'Save Changes' : 'Create Group') + '</button><button type="button" class="btn-cancel" onclick="showGroupsView()"><i class="ti ti-x"></i>Cancel</button></div>' +
            '</form></div>';

        document.getElementById('submitGroupBtn').addEventListener('click', handleGroupSubmit);
    }

    function handleGroupSubmit() {
        var name = document.getElementById('groupName').value.trim();
        if (!name) {
            showToast('Group name required.');
            return;
        }
        if (!isValidText(name)) {
            showToast('Invalid group name.');
            return;
        }
        var ids = [];
        var checkboxes = document.querySelectorAll('.checkbox-list input:checked');
        for (var i = 0; i < checkboxes.length; i++) {
            ids.push(checkboxes[i].value);
        }
        if (!ids.length) {
            showToast('Select at least one contact.');
            return;
        }

        var sanitizedName = sanitizeText(name);

        if (editingGroupId) {
            var idx = -1;
            for (var j = 0; j < groups.length; j++) {
                if (groups[j].id === editingGroupId) {
                    idx = j;
                    break;
                }
            }
            if (idx >= 0) {
                groups[idx].name = sanitizedName;
                groups[idx].memberIds = ids;
                showToast('Group updated.');
            }
            editingGroupId = null;
        } else {
            groups.push({
                id: generateId(),
                name: sanitizedName,
                memberIds: ids,
                createdAt: new Date().toISOString()
            });
            showToast('Group created.');
        }
        saveGroups();
        showGroupsView();
    }

    window.editGroup = function(id) {
        var g = null;
        for (var i = 0; i < groups.length; i++) {
            if (groups[i].id === id) {
                g = groups[i];
                break;
            }
        }
        if (g) showCreateGroupForm(g);
    };

    window.deleteGroup = function(id) {
        var g = null;
        for (var i = 0; i < groups.length; i++) {
            if (groups[i].id === id) {
                g = groups[i];
                break;
            }
        }
        if (!g) return;
        if (confirm('Delete group "' + g.name + '"?')) {
            groups = groups.filter(function(x) { return x.id !== id; });
            saveGroups();
            showToast('Group deleted.');
            if (activeView === 'groups') showGroupsView();
        }
    };

    // ============ CONTACT CRUD (Global) ============
    window.editContact = function(id) {
        var c = getContactById(id);
        if (c) showCreateForm(c);
    };

    window.deleteContact = function(id) {
        var c = getContactById(id);
        if (!c) return;
        if (confirm('Delete "' + c.name + '"?')) {
            contacts = contacts.filter(function(x) { return x.id !== id; });
            // Remove from groups
            for (var i = 0; i < groups.length; i++) {
                groups[i].memberIds = groups[i].memberIds.filter(function(mid) { return mid !== id; });
            }
            saveContacts();
            saveGroups();
            updateBadge();
            showToast('Contact deleted.');
            if (activeView === 'contacts') showContactsList();
            else if (activeView === 'favorites') showFavorites();
            else if (activeView === 'groups') showGroupsView();
        }
    };

    // ============ EXPOSE GLOBALS ============
    window.showCreateForm = showCreateForm;
    window.showContactsList = showContactsList;
    window.showGroupsView = showGroupsView;
    window.showCreateGroupForm = showCreateGroupForm;
    window.showDashboard = showDashboard;
    window.showFavorites = showFavorites;

    // ============ KEYBOARD SHORTCUTS ============
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            // Ctrl+F - Focus search
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                var searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }
            // Escape - Close modal
            if (e.key === 'Escape') {
                closeModal();
            }
            // Ctrl+N - New contact
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                showCreateForm();
            }
        });
    }

    // ============ INITIALIZATION ============
    function init() {
        console.log('Initializing Restudio Contacts...');
        loadData();
        updateBadge();
        showCreateForm();
        setupKeyboardShortcuts();
        console.log('Restudio Contacts initialized successfully');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
