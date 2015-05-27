(function ()
{

    var updateOutput = function(e) {
        var output = $(e.target).nestable('serialize'),
            string = window.JSON.stringify($(e.target).nestable('serialize')),
            deletedItems = output[1];
        $('#json').val(string);
    }

    $('.dd').nestable({
        maxDepth: 3,
        editMode: true,
        changeHandler: updateOutput,
        deletionTracking: true
    }).on('rearrange', updateOutput);

})();
