// ============ CONTACTS LIST ============
function showContactsList() {
    activeView = 'contacts';
    editingContactId = null;
    setActiveSidebarButton('btnContacts');
    updateBadge();

    var filtered = contacts.slice();

    // Filter by group
    if (currentFilterGroup !== 'all') {
        var group = groups.find(function(g) { return g.id === currentFilterGroup; });
        if (group) {
            filtered = filtered.filter(function(c) { return group.memberIds.indexOf(c.id) !== -1; });
        }
    }

    // Search
    if (searchQuery) {
        var q = searchQuery.toLowerCase();
        filtered = filtered.filter(function(c) {
            return c.name.toLowerCase().indexOf(q) !== -1 ||
                c.phone.indexOf(q) !== -1 ||
                (c.email && c.email.toLowerCase().indexOf(q) !== -1) ||
                (c.notes && c.notes.toLowerCase().indexOf(q) !== -1) ||
                (c.tags && c.tags.some(function(t) { return t.toLowerCase().indexOf(q) !== -1; }));
        });
    }

    // Sort
    switch (currentSort) {
        case 'name': filtered.sort(function(a, b) { return a.name.localeCompare(b.name); }); break;
        case 'created': filtered.sort(function(a, b) { return new Date(a.createdAt) - new Date(b.createdAt); }); break;
        case 'phone': filtered.sort(function(a, b) { return a.phone.localeCompare(b.phone); }); break;
        case 'email': filtered.sort(function(a, b) { return (a.email || '').localeCompare(b.email || ''); }); break;
    }

    var searchBarHtml = '<div style="margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;">' +
        '<input type="text" id="searchInput" placeholder="Search contacts..." oninput="liveSearch(this.value)" value="' + escapeHtml(searchQuery) + '" style="flex:1;min-width:200px;padding:10px 14px;border:1px solid var(--border-color);border-radius:24px;font-size:14px;background:#fff;">' +
        '<select id="groupFilter" onchange="filterByGroup(this.value)" style="padding:10px 14px;border-radius:24px;border:1px solid var(--border-color);font-size:14px;background:#fff;">' +
        '<option value="all">All Groups</option>' +
        groups.map(function(g) { return '<option value="' + g.id + '" ' + (currentFilterGroup === g.id ? 'selected' : '') + '>' + escapeHtml(g.name) + '</option>'; }).join('') +
        '</select>' +
        '<select id="sortSelect" onchange="sortContacts(this.value)" style="padding:10px 14px;border-radius:24px;border:1px solid var(--border-color);font-size:14px;background:#fff;">' +
        '<option value="name" ' + (currentSort === 'name' ? 'selected' : '') + '>Sort by Name</option>' +
        '<option value="created" ' + (currentSort === 'created' ? 'selected' : '') + '>Sort by Date</option>' +
        '<option value="phone" ' + (currentSort === 'phone' ? 'selected' : '') + '>Sort by Phone</option>' +
        '<option value="email" ' + (currentSort === 'email' ? 'selected' : '') + '>Sort by Email</option>' +
        '</select>' +
        '</div>';

    if (!contacts.length) {
        document.getElementById('contentArea').innerHTML =
            '<div class="section-title"><i class="ti ti-users"></i> Contacts</div>' +
            searchBarHtml +
            '<div class="empty-state"><img src="https://i.postimg.cc/vTQ4smqB/telephone.png" class="empty-image" alt="No contacts"><h3>No contacts yet</h3><p>Click <strong>Create a new contact</strong> to add your first contact.</p></div>';
        return;
    }

    if (!filtered.length) {
        document.getElementById('contentArea').innerHTML =
            '<div class="section-title"><i class="ti ti-users"></i> Contacts</div>' +
            searchBarHtml +
            '<div class="empty-state"><img src="https://i.postimg.cc/vTQ4smqB/telephone.png" class="empty-image" alt="No contacts"><h3>No contacts found</h3><p>Try adjusting your search or filters, or create a new contact.</p></div>';
        return;
    }

    var cards = filtered.map(function(c) {
        var tagsHtml = (c.tags || []).map(function(t) { return '<span class="tag-badge">' + escapeHtml(t) + '</span>'; }).join(' ');
        return '<div class="contact-card">' +
            '<button class="favorite-star ' + (c.favorite ? 'active' : '') + '" onclick="toggleFavorite(\'' + c.id + '\')"><i class="ti ti-star"></i></button>' +
            '<div class="contact-name"><img src="' + escapeHtml(c.avatar || DEFAULT_AVATAR) + '" class="contact-avatar-small" onerror="this.src=\'' + DEFAULT_AVATAR + '\'">' + escapeHtml(c.name) + '</div>' +
            '<div class="contact-detail"><i class="ti ti-phone"></i>' + escapeHtml(c.phone) + '</div>' +
            (c.email ? '<div class="contact-detail"><i class="ti ti-mail"></i>' + escapeHtml(c.email) + '</div>' : '') +
            (c.notes ? '<div class="contact-detail"><i class="ti ti-notes"></i>' + escapeHtml(c.notes) + '</div>' : '') +
            (tagsHtml ? '<div class="tags-row">' + tagsHtml + '</div>' : '') +
            '<div class="card-actions">' +
            '<button class="btn-sm" onclick="editContact(\'' + c.id + '\')"><i class="ti ti-edit"></i>Edit</button>' +
            '<button class="btn-sm danger" onclick="deleteContact(\'' + c.id + '\')"><i class="ti ti-trash"></i>Delete</button>' +
            '<button class="btn-sm" onclick="openContactModalById(\'' + c.id + '\')"><i class="ti ti-eye"></i>View</button>' +
            '</div></div>';
    }).join('');

    document.getElementById('contentArea').innerHTML =
        '<div class="section-title"><i class="ti ti-users"></i> Contacts (' + filtered.length + ')</div>' +
        searchBarHtml +
        '<div class="contacts-grid">' + cards + '</div>';
}

// ============ GROUPS ============
function showGroupsView() {
    activeView = 'groups';
    editingGroupId = null;
    setActiveSidebarButton('btnGroups');
    updateBadge();

    if (!contacts.length) {
        document.getElementById('contentArea').innerHTML =
            '<div class="section-title"><i class="ti ti-folder"></i> Groups</div>' +
            '<div class="empty-state"><img src="https://i.postimg.cc/zfKvHh6s/teamwork.png" class="empty-image" alt="No groups"><h3>No contacts yet</h3><p>Add contacts first, then create groups.</p></div>';
        return;
    }

    if (!groups.length) {
        document.getElementById('contentArea').innerHTML =
            '<div class="section-title"><i class="ti ti-folder"></i> Groups</div>' +
            '<div class="empty-state"><img src="https://i.postimg.cc/zfKvHh6s/teamwork.png" class="empty-image" alt="No groups"><h3>No groups yet</h3><p>Create a new group and add multiple contacts.</p></div>' +
            '<div style="text-align:center;margin-top:16px;"><button class="btn-submit" onclick="showCreateGroupForm()"><i class="ti ti-folder-plus"></i> Create New Group</button></div>';
        return;
    }

    var groupsWithMembers = groups.map(function(g) {
        return { id: g.id, name: g.name, memberIds: g.memberIds, members: g.memberIds.map(function(id) { return getContactById(id); }).filter(Boolean) };
    });

    var groupsHtml = groupsWithMembers.map(function(g, i) {
        return '<div class="group-card" id="groupCard-' + g.id + '" data-id="' + g.id + '">' +
            '<div class="group-header" onclick="toggleGroupExpand(\'' + g.id + '\')">' +
            '<div><span class="group-name"><i class="ti ti-folder"></i>' + escapeHtml(g.name) + '</span><span class="group-meta">(' + g.members.length + ' members)</span></div>' +
            '<div style="display:flex;gap:8px;" onclick="event.stopPropagation()">' +
            '<button class="btn-sm" onclick="editGroup(\'' + g.id + '\')"><i class="ti ti-edit"></i>Edit</button>' +
            '<button class="btn-sm danger" onclick="deleteGroup(\'' + g.id + '\')"><i class="ti ti-trash"></i>Delete</button></div></div>' +
            '<div class="group-members-expand">' +
            (g.members.length ? g.members.map(function(m) { return '<span class="group-member-tag"><img src="' + escapeHtml(m.avatar || DEFAULT_AVATAR) + '" class="group-avatar-tiny" onerror="this.src=\'' + DEFAULT_AVATAR + '\'">' + escapeHtml(m.name) + '</span>'; }).join('') : '<span style="color:var(--text-secondary)">No members</span>') +
            '</div></div>';
    }).join('');

    document.getElementById('contentArea').innerHTML =
        '<div class="section-title"><i class="ti ti-folder"></i> Groups (' + groups.length + ')</div>' +
        '<div style="margin-bottom:16px;"><button class="btn-submit" onclick="showCreateGroupForm()"><i class="ti ti-folder-plus"></i> Create New Group</button></div>' +
        '<div class="groups-list" id="groupsList">' + groupsHtml + '</div>';

    // Initialize Sortable
    var listEl = document.getElementById('groupsList');
    if (listEl && typeof Sortable !== 'undefined') {
        if (sortableInstance) sortableInstance.destroy();
        sortableInstance = new Sortable(listEl, {
            animation: 150,
            handle: '.group-header',
            onEnd: function(evt) {
                var items = Array.from(listEl.children);
                var newOrder = items.map(function(el) { return el.dataset.id; });
                var reordered = [];
                for (var i = 0; i < newOrder.length; i++) {
                    var g = groups.find(function(gr) { return gr.id === newOrder[i]; });
                    if (g) reordered.push(g);
                }
                groups = reordered;
                saveGroups();
                showToast('Group order updated.');
            }
        });
    }
}

// ============ DASHBOARD ============
function showDashboard() {
    activeView = 'dashboard';
    setActiveSidebarButton('btnDashboardSide');
    
    var totalContacts = contacts.length;
    var totalGroups = groups.length;
    var favorites = contacts.filter(function(c) { return c.favorite; }).length;
    
    var tagsSet = {};
    contacts.forEach(function(c) {
        if (c.tags) c.tags.forEach(function(t) { tagsSet[t] = (tagsSet[t] || 0) + 1; });
    });
    var tagLabels = Object.keys(tagsSet);
    var tagCounts = tagLabels.map(function(k) { return tagsSet[k]; });

    // Upcoming birthdays
    var today = new Date();
    var upcoming = contacts.filter(function(c) {
        if (!c.birthday) return false;
        var bday = new Date(c.birthday);
        bday.setFullYear(today.getFullYear());
        var diff = Math.ceil((bday - today) / (1000 * 60 * 60 * 24));
        if (diff < 0) { bday.setFullYear(today.getFullYear() + 1); diff = Math.ceil((bday - today) / (1000 * 60 * 60 * 24)); }
        return diff >= 0 && diff <= 30;
    });
    upcoming.sort(function(a, b) {
        var da = new Date(a.birthday); da.setFullYear(today.getFullYear()); if (da < today) da.setFullYear(today.getFullYear() + 1);
        var db = new Date(b.birthday); db.setFullYear(today.getFullYear()); if (db < today) db.setFullYear(today.getFullYear() + 1);
        return da - db;
    });

    var birthdayHtml = upcoming.length ? upcoming.map(function(c) {
        var bday = new Date(c.birthday);
        bday.setFullYear(today.getFullYear());
        if (bday < today) bday.setFullYear(today.getFullYear() + 1);
        var diff = Math.ceil((bday - today) / (1000 * 60 * 60 * 24));
        return '<div class="birthday-item"><span class="name"><img src="' + escapeHtml(c.avatar || DEFAULT_AVATAR) + '" class="group-avatar-tiny" onerror="this.src=\'' + DEFAULT_AVATAR + '\'"> ' + escapeHtml(c.name) + '</span><span class="days">' + diff + ' day' + (diff > 1 ? 's' : '') + '</span></div>';
    }).join('') : '<p style="color:var(--text-secondary);padding:16px 0;">No upcoming birthdays in the next 30 days.</p>';

    // Tag distribution bars
    var maxTagCount = tagCounts.length ? Math.max.apply(null, tagCounts) : 0;
    var tagBarsHtml = tagLabels.length ? tagLabels.map(function(label, i) {
        var percentage = maxTagCount > 0 ? (tagCounts[i] / maxTagCount) * 100 : 0;
        return '<div style="margin-bottom:8px;">' +
            '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px;">' +
            '<span style="font-weight:500;">' + escapeHtml(label) + '</span>' +
            '<span style="color:var(--text-secondary);">' + tagCounts[i] + '</span>' +
            '</div>' +
            '<div style="background:#f0f0f0;border-radius:6px;height:8px;overflow:hidden;">' +
            '<div style="background:var(--accent);height:100%;width:' + percentage + '%;border-radius:6px;transition:width 0.5s ease;"></div>' +
            '</div>' +
            '</div>';
    }).join('') : '<p style="color:var(--text-secondary);padding:16px 0;">No tags added yet.</p>';

    // Contacts without groups
    var contactsWithGroups = {};
    groups.forEach(function(g) {
        g.memberIds.forEach(function(id) { contactsWithGroups[id] = true; });
    });
    var contactsWithoutGroup = contacts.filter(function(c) { return !contactsWithGroups[c.id]; }).length;

    document.getElementById('contentArea').innerHTML =
        '<div class="section-title"><i class="ti ti-dashboard"></i> Dashboard</div>' +
        
        // Stats Cards
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px;">' +
        '<div style="background:#fff;border-radius:var(--radius-md);padding:20px;text-align:center;border:1px solid var(--border-color);box-shadow:var(--shadow-sm);">' +
        '<i class="ti ti-users" style="font-size:32px;color:var(--accent);display:block;margin-bottom:8px;"></i>' +
        '<div style="font-size:32px;font-weight:700;color:var(--accent);">' + totalContacts + '</div>' +
        '<div style="font-size:13px;color:var(--text-secondary);">Total Contacts</div>' +
        '</div>' +
        '<div style="background:#fff;border-radius:var(--radius-md);padding:20px;text-align:center;border:1px solid var(--border-color);box-shadow:var(--shadow-sm);">' +
        '<i class="ti ti-folder" style="font-size:32px;color:#34a853;display:block;margin-bottom:8px;"></i>' +
        '<div style="font-size:32px;font-weight:700;color:#34a853;">' + totalGroups + '</div>' +
        '<div style="font-size:13px;color:var(--text-secondary);">Total Groups</div>' +
        '</div>' +
        '<div style="background:#fff;border-radius:var(--radius-md);padding:20px;text-align:center;border:1px solid var(--border-color);box-shadow:var(--shadow-sm);">' +
        '<i class="ti ti-star" style="font-size:32px;color:#fbbc04;display:block;margin-bottom:8px;"></i>' +
        '<div style="font-size:32px;font-weight:700;color:#fbbc04;">' + favorites + '</div>' +
        '<div style="font-size:13px;color:var(--text-secondary);">Favorites</div>' +
        '</div>' +
        '<div style="background:#fff;border-radius:var(--radius-md);padding:20px;text-align:center;border:1px solid var(--border-color);box-shadow:var(--shadow-sm);">' +
        '<i class="ti ti-tags" style="font-size:32px;color:#ea4335;display:block;margin-bottom:8px;"></i>' +
        '<div style="font-size:32px;font-weight:700;color:#ea4335;">' + tagLabels.length + '</div>' +
        '<div style="font-size:13px;color:var(--text-secondary);">Unique Tags</div>' +
        '</div>' +
        '<div style="background:#fff;border-radius:var(--radius-md);padding:20px;text-align:center;border:1px solid var(--border-color);box-shadow:var(--shadow-sm);">' +
        '<i class="ti ti-user-minus" style="font-size:32px;color:#d93025;display:block;margin-bottom:8px;"></i>' +
        '<div style="font-size:32px;font-weight:700;color:#d93025;">' + contactsWithoutGroup + '</div>' +
        '<div style="font-size:13px;color:var(--text-secondary);">No Group</div>' +
        '</div>' +
        '</div>' +
        
        // Two column layout
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">' +
        
        // Left column: Birthdays + Tags
        '<div>' +
        '<div style="background:#fff;border-radius:var(--radius-md);padding:20px;border:1px solid var(--border-color);margin-bottom:24px;box-shadow:var(--shadow-sm);">' +
        '<h3 style="font-size:16px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px;"><i class="ti ti-cake" style="color:#fbbc04;"></i> Upcoming Birthdays</h3>' +
        '<div style="max-height:200px;overflow-y:auto;">' + birthdayHtml + '</div>' +
        '</div>' +
        
        '<div style="background:#fff;border-radius:var(--radius-md);padding:20px;border:1px solid var(--border-color);box-shadow:var(--shadow-sm);">' +
        '<h3 style="font-size:16px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px;"><i class="ti ti-tags" style="color:#ea4335;"></i> Tag Distribution</h3>' +
        '<div>' + tagBarsHtml + '</div>' +
        '</div>' +
        '</div>' +
        
        // Right column: Recent contacts
        '<div>' +
        '<div style="background:#fff;border-radius:var(--radius-md);padding:20px;border:1px solid var(--border-color);box-shadow:var(--shadow-sm);">' +
        '<h3 style="font-size:16px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px;"><i class="ti ti-clock" style="color:var(--accent);"></i> Recent Contacts</h3>' +
        '<div>' +
        (contacts.slice(0, 5).map(function(c) {
            return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f3f4;">' +
                '<img src="' + escapeHtml(c.avatar || DEFAULT_AVATAR) + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" onerror="this.src=\'' + DEFAULT_AVATAR + '\'">' +
                '<div style="flex:1;"><div style="font-weight:500;">' + escapeHtml(c.name) + '</div><div style="font-size:12px;color:var(--text-secondary);">' + escapeHtml(c.phone) + '</div></div>' +
                (c.favorite ? '<i class="ti ti-star" style="color:#fbbc04;"></i>' : '') +
                '</div>';
        }).join('') || '<p style="color:var(--text-secondary);padding:16px 0;">No contacts yet.</p>') +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>';
}
