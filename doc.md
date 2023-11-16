Le parseur est franchement pas incroyable, surtout en terme de code pour le moment.
il marche en prenant le document entier et en gardant deux indices, l'index actuel depuis lequel il lis le code et l'index de fin d'instruction (souvent la fin de la ligne, sauf si y'a un commentaire).
apres il essaie de match bout par bout a toutes les commandes (y'en a que une pour l'instant, c'est pour test)
la verification devariable existe, meme si vu l'architecture abominable pour l'instant ca renvoie pas de vrai erreur ca le met juste en message de warning.
faut voir si c'est possible d'utiliser la liste des variable (variables_names) pour potentiellement faire de l'auto-completion avec les variables.
Apres ca serait sympa de check les types de variables mais faut vraiment passser tout le code proprement dans une classe avant de faire ca, la c'est vraimetn pas modulaire... plus proche d'une proof of concept que d'un vrai systeme fini