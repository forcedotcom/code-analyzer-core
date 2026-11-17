({
    doInit: function (component) {
        var action = component.get('c.getAccounts');
        action.setCallback(this, function (response) {
            if (response.getState() === 'SUCCESS') {
                component.set('v.accounts', response.getReturnValue());
            }
        });
        $A.enqueueAction(action);
    },

    handleSelect: function (component) {
        var selected = document.querySelector('.slds-is-selected');
        component.set('v.selectedId', selected ? selected.dataset.id : null);
    }
});
