function Autocomplete(el, options) {
    var that = this;
    var autocompleteView;
    
    el.addEventListener('keydown', function (e) {
        if (e.keyCode == 38 || e.keyCode == 40) {
            e.preventDefault();
        }
        
        if (autocompleteView) {
            if (e.keyCode == 38) {
                console.log('up');
            } else if (e.keyCode == 40) {
                console.log('down');
            }
        }
    });
    
    el.addEventListener('keyup', function (e) {
        var input = el.value.trim();
        
        if (input === "") {
            if (autocompleteView !== undefined) {
                autocompleteView.parentNode.removeChild(autocompleteView);
                autocompleteView = undefined;
            }
            return;
        }
        
        // Just did this lookup, nothing changed
        if (autocompleteView && autocompleteView.autoCompleteValue == input) {
            return;
        }
        
        options.query(input, function (results) {
            if (autocompleteView) {
                autocompleteView.updateResults(that.render('results', results));
            } else if (results.length > 0) {
                autocompleteView = that.render('container', el);
                
                autocompleteView.autoCompleteValue = input;
                autocompleteView.updateResults(that.render('results', results));
                
                document.body.appendChild(autocompleteView);
            }
        });
        
    });
}

Autocomplete.prototype.templates = {
    'results': function (results) {
        var html = '<ul>';
        results.forEach(function(result) {
            html += '<a href="' + result.url + '"><li><div class="type">R</div>';
            html += result.title;
            html += '</li></a>';
        });
        html += '</ul>';
        
        return html;
    },
    
    'container': function (el) {
        var view;
        var box = el.getBoundingClientRect();
        
        view = document.createElement('div');
        view.className = 'autocomplete-container';
        view.style.top = box.top + 1 + box.height + 'px';
        view.innerHTML = '<div class="autocomplete"></div>';
        view.updateResults = function(html) {
            this.children[0].innerHTML = html;
        }
        view.children[0].style.left = box.left + 'px';
        view.children[0].style.width = box.width + 'px';
        view.children[0].style.paddingLeft = window.getComputedStyle(el, null).getPropertyValue('padding-left');
        return view;
    }
}

Autocomplete.prototype.render = function (template, locals) {
    return this.templates[template](locals);
}