(function ()
{

    var updateOutput = function(e) {
        var output = $(e.target).nestable('serialize'),
            string = window.JSON.stringify($(e.target).nestable('serialize')),
            deletedItems = output[1];
        $('#json').val(string);
    }

    $('.dd').nestable({
        editMode                        : true,
        changeHandler                   : updateOutput,
        deletionTracking                : true,
        maxDepth                        : 3,
        topLevelItemButton              : true,
        topLevelItemButtonLocation      : 'top',
        topLevelItemButtonAlignment     : 'left',
        iconLib                         : 'font-awesome'
    }).on('rearrange', updateOutput);

})();
