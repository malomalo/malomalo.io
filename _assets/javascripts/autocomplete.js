function Autocomplete(el, options) {
    var that = this;
    var _results, index, currentSearch, autocompleteView;
    var cleanup = function () {
        if (autocompleteView !== undefined) {
            autocompleteView.parentNode.removeChild(autocompleteView);
            autocompleteView = undefined;
            _results = undefined;
            currentSearch = undefined;
        }
    }
    
    el.addEventListener('keydown', function (e) {
        // up arrow, ctrl+j
        if ( e.keyCode === 38 || (e.keyCode === 75 && e.ctrlKey === true) ) {
            e.preventDefault();
            
            if ( autocompleteView && -1 <= index - 1 ) {
                index -= 1;

                autocompleteView.unhightlight();
                if (index >= 0) {
                    autocompleteView.highlight(index);
                }
            }
        }
        
        // down arrow, ctrl+k
        if ( e.keyCode === 40 || (e.keyCode === 74 && e.ctrlKey === true) ) {
            e.preventDefault();
            
            if ( autocompleteView && _results.length > index + 1 ) {
                index += 1;
                
                autocompleteView.unhightlight();
                autocompleteView.highlight(index);
            }
        }
        
        // esc, aleady taken care of my os, search set to emtpy which clears view
        // if ( e.keyCode === 27 ) {
        //     cleanup();
        // }
        
        // enter
        if ( e.keyCode === 13 ) {
            if ( autocompleteView && index >= 0 && index < _results.length ) {
                var result = _results[index];
                cleanup();
                el.value = "";
                options.onSelect(result);
            }
        }
    });
    
    el.addEventListener('keyup', function (e) {
        var input = el.value.trim();
        
        if (input === "") {
            cleanup();
            return;
        }
        
        // Just did this lookup, nothing changed
        if (autocompleteView && currentSearch === input) {
            return;
        }
        
        options.query(input, function (results) {
            _results = results;
            if (autocompleteView) {
                currentSearch = input;
                index = -1;
                autocompleteView.updateResults(that.render('results', results));
            } else if (results.length > 0) {
                autocompleteView = that.render('container', el);
                autocompleteView.addEventListener('click', function (e) {
                    var i = autocompleteView.findIndexForClick(e);
                    if (i) {
                        cleanup();
                        el.value = "";
                        options.onSelect(_results[i]);
                    }
                }, true);
                
                currentSearch = input;
                index = -1;
                autocompleteView.updateResults(that.render('results', results));
                
                document.body.appendChild(autocompleteView);
            }
        });
        
    });
}

function childOf(c,p){while((c=c.parentNode)&&c!==p);return !!c}

Autocomplete.prototype.templates = {
    'results': function (results) {
        var html = '<ul>';
        results.forEach(function(result) {
            html += '<li><div class="type">R</div>';
            html += result.title;
            html += '</li>';
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
        view.highlight = function (n) {
            this.children[0].children[0].children[n].classList.add('highlighted');
        }
        view.unhightlight = function () {
            var els = this.children[0].children[0].getElementsByClassName("highlighted")
            
            for(var i = 0; i < els.length; i++) {
                els[i].classList.remove('highlighted');
            }
        }
        view.findIndexForClick = function (e) {
            var els = this.children[0].children[0].children;
    
            for(var i = 0; i < els.length; i++) {
                if ( e.srcElement == els[i] || childOf(e.srcElement, els[i]) ) {
                    return i;
                }
            }
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