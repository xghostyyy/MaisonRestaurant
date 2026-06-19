// Maison — chef menu: populate and open the edit dialog from data attributes.
// (CSP-safe: no inline handlers. Dialog open/close for the "add" dialog is
// handled by the shared data-dialog-open/close logic in main.js.)

const editDialog = document.getElementById('edit-item-dialog')
const editForm = document.getElementById('edit-item-form')

function openEdit(data) {
  if (!editForm || !editDialog) return
  editForm.action = '/chef/menu/' + data.id
  document.getElementById('edit-name').value = data.name || ''
  document.getElementById('edit-desc').value = data.description || ''
  document.getElementById('edit-price').value = ((parseInt(data.price, 10) || 0) / 100).toFixed(2)
  document.getElementById('edit-allergens').value = data.allergens || ''
  document.getElementById('edit-vegan').checked = data.vegan === '1'
  document.getElementById('edit-veg').checked = data.vegetarian === '1'
  document.getElementById('edit-gf').checked = data.glutenfree === '1'

  const catSel = document.getElementById('edit-cat')
  if (catSel) {
    for (const opt of catSel.options) opt.selected = opt.value === data.category
  }
  editDialog.showModal()
}

document.querySelectorAll('[data-edit-item]').forEach((btn) => {
  btn.addEventListener('click', () => openEdit(btn.dataset))
})
