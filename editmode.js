(function ()
{

    var updateOutput = function(e) {
        $('#json').val(window.JSON.stringify($(e.target).nestable('serialize')));
    }

    $('.dd').nestable({
        maxDepth: 3,
        editMode: true,
        changeHandler: updateOutput,
        deletionTracking: true
    }).on('rearrange', updateOutput);

})();
