// Configuration globale
const API_BASE = '/api';
let currentUser = null;
let currentToken = localStorage.getItem('token');
let currentPages = [];

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', function() {
    if (currentToken) {
        validateToken();
    } else {
        showLoginModal();
    }
    
    setupEventListeners();
});

// Configuration des événements
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showSection(e.target.dataset.section);
        });
    });

    // Forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('addPageForm').addEventListener('submit', handleAddPage);
    document.getElementById('addResponseForm').addEventListener('submit', handleAddResponse);
    document.getElementById('aiConfigForm').addEventListener('submit', handleAIConfig);

    // Selects
    document.getElementById('pageSelect').addEventListener('change', loadResponses);
    document.getElementById('historyPageSelect').addEventListener('change', loadHistory);
}

// Gestion de l'authentification
async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(formData))
        });

        const data = await response.json();
        
        if (response.ok) {
            currentToken = data.token;
            currentUser = data.user;
            localStorage.setItem('token', currentToken);
            hideLoginModal();
            loadDashboard();
        } else {
            showAlert('Erreur de connexion: ' + data.error, 'danger');
        }
    } catch (error) {
        showAlert('Erreur de connexion', 'danger');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(formData))
        });

        const data = await response.json();
        
        if (response.ok) {
            showAlert('Compte créé avec succès! Vous pouvez maintenant vous connecter.', 'success');
            document.querySelector('[href="#login-tab"]').click();
            e.target.reset();
        } else {
            showAlert('Erreur: ' + data.error, 'danger');
        }
    } catch (error) {
        showAlert('Erreur lors de la création du compte', 'danger');
    }
}

async function validateToken() {
    try {
        const response = await apiCall('/facebook/pages');
        if (response.ok) {
            loadDashboard();
        } else {
            localStorage.removeItem('token');
            showLoginModal();
        }
    } catch (error) {
        localStorage.removeItem('token');
        showLoginModal();
    }
}

function logout() {
    localStorage.removeItem('token');
    currentToken = null;
    currentUser = null;
    currentPages = [];
    showLoginModal();
}

// Gestion des API calls
async function apiCall(endpoint, options = {}) {
    const config = {
        headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };
    
    return fetch(`${API_BASE}${endpoint}`, config);
}

// Gestion des pages Facebook
async function handleAddPage(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await apiCall('/facebook/pages', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (response.ok) {
            showAlert('Page ajoutée avec succès!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addPageModal')).hide();
            e.target.reset();
            loadPages();
        } else {
            showAlert('Erreur: ' + result.error, 'danger');
        }
    } catch (error) {
        showAlert('Erreur lors de l\'ajout de la page', 'danger');
    }
}

async function loadPages() {
    try {
        const response = await apiCall('/facebook/pages');
        currentPages = await response.json();
        
        renderPages();
        populatePageSelects();
        updateDashboardStats();
    } catch (error) {
        showAlert('Erreur lors du chargement des pages', 'danger');
    }
}

function renderPages() {
    const tbody = document.getElementById('pagesTable');
    tbody.innerHTML = '';
    
    currentPages.forEach(page => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${page.page_name}</td>
            <td>${page.page_id}</td>
            <td>
                <span class="badge ${page.is_active ? 'bg-success' : 'bg-danger'}">
                    ${page.is_active ? 'Actif' : 'Inactif'}
                </span>
            </td>
            <td>${new Date(page.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="deletePage(${page.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function populatePageSelects() {
    const selects = ['pageSelect', 'responsePageSelect', 'aiPageSelect', 'historyPageSelect'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        // Garder la première option
        const firstOption = select.querySelector('option');
        select.innerHTML = '';
        select.appendChild(firstOption);
        
        currentPages.forEach(page => {
            const option = document.createElement('option');
            option.value = page.page_id;
            option.textContent = page.page_name;
            select.appendChild(option);
        });
    });
}

// Gestion des réponses prédéfinies
async function handleAddResponse(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await apiCall('/responses', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (response.ok) {
            showAlert('Réponse ajoutée avec succès!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addResponseModal')).hide();
            e.target.reset();
            loadResponses();
        } else {
            showAlert('Erreur: ' + result.error, 'danger');
        }
    } catch (error) {
        showAlert('Erreur lors de l\'ajout de la réponse', 'danger');
    }
}

async function loadResponses() {
    const pageId = document.getElementById('pageSelect').value;
    if (!pageId) {
        document.getElementById('responsesTable').innerHTML = '';
        return;
    }
    
    try {
        const response = await apiCall(`/responses/${pageId}`);
        const responses = await response.json();
        
        renderResponses(responses);
    } catch (error) {
        showAlert('Erreur lors du chargement des réponses', 'danger');
    }
}

function renderResponses(responses) {
    const tbody = document.getElementById('responsesTable');
    tbody.innerHTML = '';
    
    responses.forEach(response => {
        const row = document.createElement('tr');
        const priorityClass = response.priority === 3 ? 'priority-high' : 
                            response.priority === 2 ? 'priority-medium' : 'priority-low';
        
        row.innerHTML = `
            <td><strong>${response.keyword}</strong></td>
            <td>${response.response.substring(0, 100)}${response.response.length > 100 ? '...' : ''}</td>
            <td>
                <span class="badge ${priorityClass}">
                    ${response.priority}
                </span>
            </td>
            <td>
                <span class="badge ${response.is_active ? 'bg-success' : 'bg-danger'}">
                    ${response.is_active ? 'Actif' : 'Inactif'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteResponse(${response.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function deleteResponse(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette réponse?')) return;
    
    try {
        const response = await apiCall(`/responses/${id}`, { method: 'DELETE' });
        
        if (response.ok) {
            showAlert('Réponse supprimée avec succès!', 'success');
            loadResponses();
        } else {
            showAlert('Erreur lors de la suppression', 'danger');
        }
    } catch (error) {
        showAlert('Erreur lors de la suppression', 'danger');
    }
}

// Gestion de la configuration IA
async function handleAIConfig(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await apiCall('/ai-config', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (response.ok) {
            showAlert('Configuration IA mise à jour avec succès!', 'success');
        } else {
            showAlert('Erreur: ' + result.error, 'danger');
        }
    } catch (error) {
        showAlert('Erreur lors de la mise à jour', 'danger');
    }
}

async function loadAIConfig(pageId) {
    if (!pageId) return;
    
    try {
        const response = await apiCall(`/ai-config/${pageId}`);
        const config = await response.json();
        
        if (config) {
            const form = document.getElementById('aiConfigForm');
            Object.keys(config).forEach(key => {
                const input = form.querySelector(`[name="${key}"]`);
                if (input && config[key]) {
                    input.value = config[key];
                }
            });
        }
    } catch (error) {
        console.error('Erreur lors du chargement de la configuration IA:', error);
    }
}

// Gestion de l'historique
async function loadHistory() {
    const pageId = document.getElementById('historyPageSelect').value;
    
    try {
        const endpoint = pageId ? `/history/${pageId}` : '/history/all';
        const response = await apiCall(endpoint);
        const history = await response.json();
        
        renderHistory(history);
    } catch (error) {
        showAlert('Erreur lors du chargement de l\'historique', 'danger');
    }
}

function renderHistory(history) {
    const tbody = document.getElementById('historyTable');
    tbody.innerHTML = '';
    
    history.forEach(entry => {
        const row = document.createElement('tr');
        const typeClass = entry.response_type === 'ai' ? 'text-primary' : 
                         entry.response_type === 'predefined' ? 'text-success' : 'text-muted';
        
        row.innerHTML = `
            <td>${new Date(entry.processed_at).toLocaleString()}</td>
            <td>${entry.sender_id.substring(0, 10)}...</td>
            <td>${entry.message_text ? entry.message_text.substring(0, 50) + '...' : ''}</td>
            <td>${entry.response_text ? entry.response_text.substring(0, 50) + '...' : 'Pas de réponse'}</td>
            <td><span class="${typeClass}">${entry.response_type || 'none'}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Gestion du dashboard
async function loadDashboard() {
    hideLoginModal();
    document.getElementById('userInfo').textContent = `Bienvenue, ${currentUser?.username || 'Utilisateur'}`;
    
    await loadPages();
    showSection('dashboard');
    updateDashboardStats();
}

async function updateDashboardStats() {
    document.getElementById('totalPages').textContent = currentPages.length;
    
    // Calculer le nombre total de réponses actives
    let totalResponses = 0;
    for (const page of currentPages) {
        try {
            const response = await apiCall(`/responses/${page.page_id}`);
            const responses = await response.json();
            totalResponses += responses.filter(r => r.is_active).length;
        } catch (error) {
            console.error('Erreur lors du calcul des réponses:', error);
        }
    }
    document.getElementById('totalResponses').textContent = totalResponses;
    
    // Pour les autres stats, vous pouvez ajouter des endpoints API appropriés
    document.getElementById('totalMessages').textContent = '0';
    document.getElementById('aiConfigured').textContent = '0';
}

// Utilitaires UI
function showSection(sectionName) {
    // Cacher toutes les sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Afficher la section demandée
    document.getElementById(`${sectionName}-section`).classList.remove('hidden');
    
    // Mettre à jour la navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
    
    // Charger les données spécifiques à la section
    switch(sectionName) {
        case 'pages':
            loadPages();
            break;
        case 'responses':
            loadResponses();
            break;
        case 'history':
            loadHistory();
            break;
        case 'ai-config':
            // Charger la configuration IA si une page est sélectionnée
            const aiPageSelect = document.getElementById('aiPageSelect');
            aiPageSelect.addEventListener('change', (e) => {
                if (e.target.value) loadAIConfig(e.target.value);
            });
            break;
    }
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}

function showLoginModal() {
    const modal = new bootstrap.Modal(document.getElementById('loginModal'));
    modal.show();
}

function hideLoginModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
    if (modal) modal.hide();
}

// Fonctions utilitaires supplémentaires
async function deletePage(pageId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette page?')) return;
    
    try {
        const response = await apiCall(`/facebook/pages/${pageId}`, { method: 'DELETE' });
        
        if (response.ok) {
            showAlert('Page supprimée avec succès!', 'success');
            loadPages();
        } else {
            showAlert('Erreur lors de la suppression', 'danger');
        }
    } catch (error) {
        showAlert('Erreur lors de la suppression', 'danger');
    }
}
